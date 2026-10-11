using System.Collections.Concurrent;
using Microsoft.AspNetCore.SignalR;

namespace NexusSocial.Hubs;

public class NexusHub : Hub
{
    // Maps UserId to active ConnectionIds
    private static readonly ConcurrentDictionary<string, HashSet<string>> UserConnections = new();
    private static readonly ConcurrentDictionary<string, string> ConnectionToUser = new();

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

    public async Task RegisterUser(string userId)
    {
        if (string.IsNullOrWhiteSpace(userId)) return;

        ConnectionToUser[Context.ConnectionId] = userId;
        var connections = UserConnections.GetOrAdd(userId, _ => new HashSet<string>());
        lock (connections)
        {
            connections.Add(Context.ConnectionId);
        }

        await Clients.Others.SendAsync("UserPresenceChanged", userId, true);
        await Clients.Caller.SendAsync("RegisteredSuccess", userId);
    }

    // ─── LIVE MESSAGING ──────────────────────────────────────────
    public async Task SendLiveMessage(string toUserId, object messageData)
    {
        if (ConnectionToUser.TryGetValue(Context.ConnectionId, out var fromUserId))
        {
            // Send to recipient if connected
            if (UserConnections.TryGetValue(toUserId, out var recipientConnections))
            {
                List<string> connList;
                lock (recipientConnections)
                {
                    connList = recipientConnections.ToList();
                }
                foreach (var connId in connList)
                {
                    await Clients.Client(connId).SendAsync("ReceiveLiveMessage", fromUserId, messageData);
                }
            }

            // Acknowledge back to sender
            await Clients.Caller.SendAsync("MessageSentAck", toUserId, messageData);
        }
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
