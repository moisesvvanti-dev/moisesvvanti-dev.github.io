import os
import re

file_path = 'assets/js/kord_webrtc.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace variables at the top
old_vars = """let localStream = null;
let mediaRecorder = null;
let audioChunksRef = null;
let remoteAudioPlayers = {};"""

new_vars = """let localStream = null;
let mediaRecorder = null;
let peerConnections = {}; // WEBRTC
let remoteAudioPlayers = {};"""
content = content.replace(old_vars, new_vars)

# We will remove the entire block from "    // 1. Send Audio Chunks (Walkie-Talkie Logic)"
# up to "    // Auto-enable AI Translator logic"
regex_block = re.search(r"    // 1\. Send Audio Chunks \(Walkie-Talkie Logic\).*?    // Auto-enable AI Translator logic \(always active, no need to toggle\)", content, re.DOTALL)

webrtc_replacement = """    // 1. Setup Local Audio Analyzer (Green Glow / VAD)
    if (localStream.getAudioTracks().length > 0) {
        setupLocalSpeakingDetector(localStream);
    }
    
    // WebRTC Signaling Listener
    listenForSignals();

    // 2. Listen to Remote Participants - persistent value listener for real-time updates
    roomRef.child('participants').on('value', snap => {
        const participants = snap.val() || {};
        const currentPeers = Object.keys(participants).filter(uid => uid !== currentUser.uid);

        // Add new peers
        currentPeers.forEach(peerUid => {
            if (!document.getElementById(`video_${peerUid}`)) {
                addRemoteVideoPlaceholders(peerUid);
                
                // MESH: Caller is the one with higher UID lexicographically
                if (currentUser.uid > peerUid) {
                    const pc = getPeerConnection(peerUid);
                    pc.createOffer().then(offer => pc.setLocalDescription(offer)).then(() => {
                        roomRef.child('signals').push({
                            type: 'offer',
                            from: currentUser.uid,
                            to: peerUid,
                            sdp: pc.localDescription.sdp
                        });
                    });
                }
            }
            const p = participants[peerUid];
            updateRemoteMuteUI(peerUid, p.muted, p.deafened);

            // Handle transcriptions
            if (isAITranslatorActive && p.lastTranscript && p.transcriptTime) {
                handleRemoteTranscription(peerUid, p.lastTranscript, p.transcriptTime);
            }
        });

        // Remove peers that left
        const allTiles = document.querySelectorAll('[id^="video_"]');
        allTiles.forEach(tile => {
            const tileUid = tile.id.replace('video_', '');
            if (tileUid !== 'local' && !participants[tileUid]) {
                removeRemoteVideo(tileUid);
                if (peerConnections[tileUid]) {
                    peerConnections[tileUid].close();
                    delete peerConnections[tileUid];
                }
                const audioEl = document.getElementById(`remote_audio_${tileUid}`);
                if (audioEl) audioEl.remove();
                if (remoteWhisperRecorders[tileUid]) {
                    remoteWhisperRecorders[tileUid].stop();
                    delete remoteWhisperRecorders[tileUid];
                }
            }
        });

        // Always rebuild member list
        updateCallMembersList();
    });

    // Auto-enable AI Translator logic"""

if regex_block:
    content = content.replace(regex_block.group(0), webrtc_replacement)

# Add WebRTC helpers
webrtc_helpers = """
// ==========================================
// TRUE WEBRTC MESH CONNECTIONS
// ==========================================
const kordIceConfig = {
    iceServers: [
        { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
        { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" }
    ],
    iceTransportPolicy: "relay" // FORCE Relay for 100% Anonymity / IP Leak prevention (Bug Bounty standard)
};

function getPeerConnection(peerUid) {
    if (peerConnections[peerUid]) return peerConnections[peerUid];

    const pc = new RTCPeerConnection(kordIceConfig);
    peerConnections[peerUid] = pc;

    if (localStream) {
        localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
    }

    pc.onicecandidate = (e) => {
        if (e.candidate && roomRef) {
            roomRef.child('signals').push({
                type: 'candidate',
                from: currentUser.uid,
                to: peerUid,
                candidate: JSON.stringify(e.candidate)
            });
        }
    };

    pc.ontrack = (e) => {
        let audioEl = document.getElementById(`remote_audio_${peerUid}`);
        if (!audioEl) {
            audioEl = document.createElement('audio');
            audioEl.id = `remote_audio_${peerUid}`;
            audioEl.autoplay = true;
            document.body.appendChild(audioEl);
        }
        audioEl.srcObject = e.streams[0];
        // Ensure remote stream mutes correctly based on current states
        audioEl.muted = isDeafened; // If I'm deafened, mute remote
        
        setupRemoteSpeakingDetector(e.streams[0], peerUid);
        setupRemoteWhisperRecorder(e.streams[0], peerUid);
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            pc.close();
            delete peerConnections[peerUid];
            const audioEl = document.getElementById(`remote_audio_${peerUid}`);
            if (audioEl) audioEl.remove();
        }
    };

    return pc;
}

function listenForSignals() {
    roomRef.child('signals').on('child_added', snap => {
        const data = snap.val();
        if (data.to !== currentUser.uid) return;

        snap.ref.remove(); // Clean immediately
        const pc = getPeerConnection(data.from);

        if (data.type === 'offer') {
            pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }))
              .then(() => pc.createAnswer())
              .then(answer => pc.setLocalDescription(answer))
              .then(() => {
                  roomRef.child('signals').push({
                      type: 'answer',
                      from: currentUser.uid,
                      to: data.from,
                      sdp: pc.localDescription.sdp
                  });
              });
        } else if (data.type === 'answer') {
            pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
        } else if (data.type === 'candidate') {
            pc.addIceCandidate(new RTCIceCandidate(JSON.parse(data.candidate)));
        }
    });
}

function setupRemoteSpeakingDetector(stream, peerUid) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const interval = setInterval(() => {
            if (!isCallActive) return clearInterval(interval);
            const tile = document.getElementById(`video_${peerUid}`);
            if (!tile) return clearInterval(interval);

            analyser.getByteFrequencyData(dataArray);
            let sum = 0; for(let i=0; i<dataArray.length; i++) sum += dataArray[i];
            const avg = sum / dataArray.length;

            if (avg > 15 && !isDeafened) {
                tile.style.borderColor = '#22c55e';
                tile.style.boxShadow = '0 0 20px rgba(34, 197, 94, 0.4)';
                const aw = tile.querySelector('.avatar-wrap');
                if(aw) aw.style.boxShadow = '0 0 15px #22c55e, 0 0 25px #22c55e';
            } else {
                tile.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                tile.style.boxShadow = 'none';
                const aw = tile.querySelector('.avatar-wrap');
                if(aw) aw.style.boxShadow = 'none';
            }
        }, 150);
    } catch(e) {}
}

let remoteWhisperRecorders = {};
function setupRemoteWhisperRecorder(stream, peerUid) {
    if (!isAITranslatorActive) return;
    try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        const rec = new MediaRecorder(stream, { mimeType });
        let chunks = [];
        rec.ondataavailable = e => { if (e.data.size > 0 && !isDeafened) chunks.push(e.data); };
        rec.onstop = async () => {
            if (chunks.length === 0 || !isAITranslatorActive) return;
            const blob = new Blob(chunks, { type: mimeType });
            chunks = [];
            if (isAITranslatorActive && peerConnections[peerUid]) {
                try { rec.start(4000); } catch(e){}
            }
            
            if (blob.size < 12000) return; // Ignore silence
            
            let peerName = 'Participante';
            const nameEl = document.querySelector(`#video_${peerUid} .kord-video-label`);
            if (nameEl) peerName = nameEl.innerText;

            const transcript = await whisperTranscribe(blob);
            if (transcript && transcript.length > 2 && !isWhisperHallucination(transcript)) {
                // Determine sound effects
                const soundEffect = detectSoundEffect(transcript);
                if (soundEffect !== false) {
                    if (soundEffect !== null) {
                        const subtitleText = document.getElementById('kord-subtitle-text');
                        if (subtitleText) subtitleText.innerHTML = `<span style="color:#94a3b8;">${peerName}:</span> <span style="font-size:1.2em;">${soundEffect}</span>`;
                        const subBox = document.getElementById('kord-ai-subtitles');
                        if (subBox) { subBox.style.display = 'block'; subBox.style.animation = 'none'; subBox.offsetHeight; subBox.style.animation = 'fadeSubtitles 4s ease forwards'; }
                    }
                    return;
                }

                const subtitleText = document.getElementById('kord-subtitle-text');
                if (subtitleText) {
                    subtitleText.innerHTML = `<span style="color:#94a3b8;">🎧 ${peerName}:</span> <span style="color:#e2e8f0;">"${transcript}"</span>`;
                }
                const subBox = document.getElementById('kord-ai-subtitles');
                if (subBox) { subBox.style.display = 'block'; subBox.style.animation = 'none'; }

                const langTarget = document.getElementById('kordTranslateTarget')?.value || 'pt-BR';
                const translatedText = await processGroqTranslation(transcript, "Auto", langTarget);

                if (translatedText && translatedText !== transcript) {
                    if (subtitleText) {
                         subtitleText.innerHTML = `<span style="color:#94a3b8;">🎧 ${peerName}:</span> <span style="color:#64748b; font-size:0.85em;">"${transcript}"</span><br><span style="color:#a78bfa;">🌐 Tradução:</span> <span style="color:#f8fafc; font-weight:600;">"${translatedText}"</span>`;
                    }
                    if (subBox) {
                       subBox.style.animation = 'none';
                       subBox.offsetHeight;
                       subBox.style.animation = 'fadeSubtitles 8s ease forwards';
                    }
                    setTimeout(() => { if (isAITranslatorActive) kordSpeakText(translatedText, langTarget); }, 800);
                } else {
                    finalizeSubtitle(transcript, peerName);
                }
            }
        };
        rec.start(4000);
        remoteWhisperRecorders[peerUid] = rec;
    } catch(e) {}
}
"""

# Remove old queueRemoteAudio / playRemoteAudioChunk functions up to "function startPresenceHeartbeat()"
queue_block = re.search(r"// Audio queue per peer to prevent overlap.*?// ==========================================\n// PRESENCE HEARTBEAT \(Prevents Ghost Entries\)", content, re.DOTALL)
if queue_block:
    content = content.replace(queue_block.group(0), webrtc_helpers + "\n// ==========================================\n// PRESENCE HEARTBEAT (Prevents Ghost Entries)")

# Add cleanup logic to disconnectKordCall()
disconnect_cleanup = """    // Clean Firebase
    if (presenceRef) presenceRef.remove();
    if (audioChunksRef) audioChunksRef.remove();
    if (roomRef) {
        roomRef.child('participants').off();
        roomRef.child('signals').off(); // WebRTC signals
    }

    Object.keys(peerConnections).forEach(uid => {
        peerConnections[uid].close();
        const aEl = document.getElementById(`remote_audio_${uid}`);
        if (aEl) aEl.remove();
    });
    peerConnections = {};
    Object.keys(remoteWhisperRecorders).forEach(uid => remoteWhisperRecorders[uid].stop());
    remoteWhisperRecorders = {};"""

content = content.replace("""    // Clean Firebase
    if (presenceRef) presenceRef.remove();
    if (audioChunksRef) audioChunksRef.remove();
    if (roomRef) {
        roomRef.child('participants').off();
        roomRef.child('audio_chunks').off();
    }""", disconnect_cleanup)


# Toggle Deafen logic needs to mute remote audios locally
deafen_logic_old = """    if (isDeafened) {
        isAudioEnabled = false;
        if (localStream && localStream.getAudioTracks().length > 0) {
            localStream.getAudioTracks().forEach(t => t.enabled = false);
        }
        if (micBtn) {
            micBtn.innerHTML = `<span class="material-icons-round">mic_off</span>`;
            micBtn.classList.add('kord-rtc-btn--active');
        }
    }"""
    
deafen_logic_new = """    if (isDeafened) {
        isAudioEnabled = false;
        if (localStream && localStream.getAudioTracks().length > 0) {
            localStream.getAudioTracks().forEach(t => t.enabled = false);
        }
        if (micBtn) {
            micBtn.innerHTML = `<span class="material-icons-round">mic_off</span>`;
            micBtn.classList.add('kord-rtc-btn--active');
        }
    }
    
    // Mute/Unmute all remote peer connections
    Object.keys(peerConnections).forEach(uid => {
        const audioEl = document.getElementById(`remote_audio_${uid}`);
        if(audioEl) audioEl.muted = isDeafened;
    });"""

content = content.replace(deafen_logic_old, deafen_logic_new)

# Remove "Audio Garbage Collector"
gc_block = re.search(r"// Garbage Collector.*setInterval\(runAudioGarbageCollector, 5000\);", content, re.DOTALL)
if gc_block:
    content = content.replace(gc_block.group(0), "")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied.")
