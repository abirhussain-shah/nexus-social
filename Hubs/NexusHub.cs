using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace NexusSocial.Hubs;

public class NexusHub : Hub
{
    // Maps UserId to active ConnectionIds
    private static readonly ConcurrentDictionary<string, HashSet<string>> UserConnections = new();
    private static readonly ConcurrentDictionary<string, string> ConnectionToUser = new();
    public static readonly ConcurrentDictionary<string, object> KnownUsers = new();

    public override Task OnConnectedAsync()
    {
        return base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (ConnectionToUser.TryRemove(Context.ConnectionId, out var userId))
        {
            if (UserConnections.TryGetValue(userId, out var connections))
            {
                lock (connections)
                {
                    connections.Remove(Context.ConnectionId);
                    if (connections.Count == 0)
                    {
                        UserConnections.TryRemove(userId, out _);
                    }
                }
            }
            await Clients.Others.SendAsync("UserPresenceChanged", userId, false);
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task RegisterUser(string userId, object? userInfo = null)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;

        ConnectionToUser[Context.ConnectionId] = userId;
        var connections = UserConnections.GetOrAdd(userId, _ => new HashSet<string>());
        lock (connections)
        {
            connections.Add(Context.ConnectionId);
        }

        if (userInfo != null)
        {
            KnownUsers[userId] = userInfo;
            await Clients.Others.SendAsync("UserRegistered", userId, userInfo);
        }

        await Clients.Others.SendAsync("UserPresenceChanged", userId, true);
        await Clients.Caller.SendAsync("RegisteredSuccess", userId);
    }

    // ─── LIVE MESSAGING ──────────────────────────────────────────
    public async Task SendLiveMessage(string toUserId, object messageData)
    {
        string? fromUserId = null;
        string? targetUserId = toUserId;

        // Robustly extract sender and target IDs from messageData
        if (messageData is System.Text.Json.JsonElement elem)
        {
            if (elem.TryGetProperty("from", out var pFrom) || elem.TryGetProperty("From", out pFrom))
            {
                var s = pFrom.GetString();
                if (!string.IsNullOrWhiteSpace(s)) fromUserId = s;
            }
            if (string.IsNullOrWhiteSpace(targetUserId) && (elem.TryGetProperty("to", out var pTo) || elem.TryGetProperty("To", out pTo)))
            {
                var s = pTo.GetString();
                if (!string.IsNullOrWhiteSpace(s)) targetUserId = s;
            }
        }
        else if (messageData != null)
        {
            try
            {
                var json = System.Text.Json.JsonSerializer.Serialize(messageData);
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("from", out var pFrom) || doc.RootElement.TryGetProperty("From", out pFrom))
                {
                    var s = pFrom.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) fromUserId = s;
                }
                if (string.IsNullOrWhiteSpace(targetUserId) && (doc.RootElement.TryGetProperty("to", out var pTo) || doc.RootElement.TryGetProperty("To", out pTo)))
                {
                    var s = pTo.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) targetUserId = s;
                }
            }
            catch { }
        }

        if (string.IsNullOrWhiteSpace(fromUserId))
        {
            ConnectionToUser.TryGetValue(Context.ConnectionId, out fromUserId);
        }

        if (!string.IsNullOrWhiteSpace(fromUserId))
        {
            ConnectionToUser[Context.ConnectionId] = fromUserId;
            var conns = UserConnections.GetOrAdd(fromUserId, _ => new HashSet<string>());
            lock (conns)
            {
                conns.Add(Context.ConnectionId);
            }
        }

        fromUserId ??= "anonymous";

        // Deliver directly to target client connections if found
        if (!string.IsNullOrWhiteSpace(targetUserId) && UserConnections.TryGetValue(targetUserId, out var recipientConnections))
        {
            List<string> connList;
            lock (recipientConnections)
            {
                connList = recipientConnections.ToList();
            }
            foreach (var connId in connList)
            {
                if (connId != Context.ConnectionId)
                {
                    await Clients.Client(connId).SendAsync("ReceiveLiveMessage", fromUserId, messageData);
                }
            }
        }

        // Deliver to all other connected clients as well; recipient client matches on messageData.to == currentId
        // This ensures zero dropped messages across reconnects, multiple tabs, and browser profiles
        await Clients.Others.SendAsync("ReceiveLiveMessage", fromUserId, messageData);

        // Acknowledge back to sender
        await Clients.Caller.SendAsync("MessageSentAck", toUserId, messageData);
    }

    // ─── WEBRTC CALL SIGNALING ───────────────────────────────────
    public async Task StartCall(string toUserId, string callType, object callPayload)
    {
        if (ConnectionToUser.TryGetValue(Context.ConnectionId, out var fromUserId))
        {
            if (UserConnections.TryGetValue(toUserId, out var recipientConnections))
            {
                List<string> connList;
                lock (recipientConnections)
                {
                    connList = recipientConnections.ToList();
                }
                foreach (var connId in connList)
                {
                    await Clients.Client(connId).SendAsync("IncomingCallSignal", fromUserId, callType, callPayload);
                }
            }
            else
            {
                await Clients.Caller.SendAsync("CallFailed", toUserId, "User is currently offline");
            }
        }
    }

    public async Task AcceptCall(string callerId, object answerPayload)
    {
        if (ConnectionToUser.TryGetValue(Context.ConnectionId, out var receiverId))
        {
            if (UserConnections.TryGetValue(callerId, out var callerConnections))
            {
                List<string> connList;
                lock (callerConnections)
                {
                    connList = callerConnections.ToList();
                }
                foreach (var connId in connList)
                {
                    await Clients.Client(connId).SendAsync("CallAcceptedSignal", receiverId, answerPayload);
                }
            }
        }
    }

    public async Task DeclineCall(string callerId)
    {
        if (ConnectionToUser.TryGetValue(Context.ConnectionId, out var receiverId))
        {
            if (UserConnections.TryGetValue(callerId, out var callerConnections))
            {
                List<string> connList;
                lock (callerConnections)
                {
                    connList = callerConnections.ToList();
                }
                foreach (var connId in connList)
                {
                    await Clients.Client(connId).SendAsync("CallDeclinedSignal", receiverId);
                }
            }
        }
    }

    public async Task EndCall(string peerId)
    {
        if (ConnectionToUser.TryGetValue(Context.ConnectionId, out var senderId))
        {
            if (UserConnections.TryGetValue(peerId, out var peerConnections))
            {
                List<string> connList;
                lock (peerConnections)
                {
                    connList = peerConnections.ToList();
                }
                foreach (var connId in connList)
                {
                    await Clients.Client(connId).SendAsync("CallEndedSignal", senderId);
                }
            }
        }
    }

    public async Task SendIceCandidate(string targetUserId, object candidatePayload)
    {
        if (ConnectionToUser.TryGetValue(Context.ConnectionId, out var fromUserId))
        {
            if (UserConnections.TryGetValue(targetUserId, out var targetConnections))
            {
                List<string> connList;
                lock (targetConnections)
                {
                    connList = targetConnections.ToList();
                }
                foreach (var connId in connList)
                {
                    await Clients.Client(connId).SendAsync("ReceiveIceCandidate", fromUserId, candidatePayload);
                }
            }
        }
    }
}
