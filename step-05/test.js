'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var peer_id_;

var pcConfig = {
    'iceServers': [
        {
            uri: 'turn:numb.viagenie.ca',
            credential: 'muazkh',
            username: 'webrtc@live.com'
        }
    ]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
    offerToReceiveAudio: true,
    offerToReceiveVideo: true
};

/////////////////////////////////////////////

var room = 'foo';

if (location.hostname !== 'localhost') {
    // requestTurn(
    //     'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
    // );
}

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true
}).then(gotStream).catch(function (e) {
    alert('getUserMedia() error: ' + e.name);
});
function gotStream(stream) {
    localStream = stream;
    localVideo.srcObject = stream
}

function createPeerConnection() {
    try {
        pc = new RTCPeerConnection(null);
        pc.onicecandidate = handleIceCandidate;
        pc.onaddstream = handleRemoteStreamAdded;
        pc.onremovestream = handleRemoteStreamRemoved;
        console.log('Created RTCPeerConnnection');
    } catch (e) {
        console.log('Failed to create PeerConnection, exception: ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    }
}
function handleIceCandidate(event) {
    console.log('icecandidate event: ', event);
    if (event.candidate) {

        var data = {
            candidate: event.candidate.candidate,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            sdpMid: event.candidate.sdpMid
        }
        sendJsonToPeer(peer_id_, data);
    } else {
        console.log('End of candidates.');
    }
}
function handleRemoteStreamAdded(event) {
    console.log('Remote stream added.');
    remoteStream = event.stream;
    remoteVideo.srcObject = remoteStream;
}
function handleRemoteStreamRemoved(event) {
    console.log('Remote stream removed. Event: ', event);
}
function requestTurn(turnURL) {
    var turnExists = false;
    for (var i in pcConfig.iceServers) {
        if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
            turnExists = true;
            turnReady = true;
            break;
        }
    }
    if (!turnExists) {
        console.log('Getting TURN server from ', turnURL);
        // No TURN server. Get one from computeengineondemand.appspot.com:
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var turnServer = JSON.parse(xhr.responseText);
                console.log('Got TURN server: ', turnServer);
                pcConfig.iceServers.push({
                    'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
                    'credential': turnServer.password
                });
                turnReady = true;
            }
        };
        xhr.open('GET', turnURL, true);
        xhr.send();
    }
}
function doCall() {
    console.log('Sending offer to peer');
    pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}
function setLocalAndSendMessage(sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    sendJsonToPeer(peer_id_, sessionDescription);
}
function handleCreateOfferError(event) {
    console.log('createOffer() error: ', event);
}

function maybeStart() {
    console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
    if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
        console.log('>>>>>> creating peer connection');
        createPeerConnection();
        pc.addStream(localStream);
        isStarted = true;
        console.log('isInitiator', isInitiator);
        if (isInitiator) {
            doCall();
        }
    }
}
function doAnswer() {
    console.log('Sending answer to peer.');
    pc.createAnswer().then(
        setLocalAndSendMessage,
        onCreateSessionDescriptionError
    );
}
function onCreateSessionDescriptionError(error) {
    trace('Failed to create session description: ' + error.toString());
}

function handlePeerMessage(peer_id, message) {
    message = JSON.parse(message);
    console.log(message);
    if (message.type === 'offer') {
        peer_id_ = peer_id;
        isChannelReady = true;
        if (!isInitiator && !isStarted) {
            maybeStart();
        }
        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
    } else if (message.type === 'answer' && isStarted) {
        peer_id_ = peer_id;
        pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message === 'BYE') {
        pc.close();
        isStarted = false;
        pc = null;
    } else {
        var candidate = new RTCIceCandidate({
            sdpMLineIndex: message.sdpMLineIndex,
            candidate: message.candidate
        });
        pc.addIceCandidate(candidate);
    }

}
function call() {
    peer_id_ = parseInt(document.getElementById("peer_id").value);
    isChannelReady = true;
    isInitiator = false;
    isInitiator = true;
    isStarted = false;
    maybeStart();
}
