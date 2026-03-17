import re

with open('assets/js/kord_webrtc.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('console.warn("Sem câmera detectada ou recusada. Tentando apenas Microfone...");', 'showKordAlert("Câmera Indisponível", "Não encontramos uma câmera ou permissão negada. Entrando com voz...", "videocam_off", "#f59e0b");')
text = text.replace('console.warn("Sem Microfone também. Entrando apenas como Ouvinte/Espectador.");', 'showKordAlert("Microfone Indisponível", "Não há microfone. Entrando apenas como ouvinte.", "mic_off", "#ef4444");')
text = text.replace('console.warn("Speaking detector setup failed:", e);', '/* Silent fail user should not see internal UI failures */')
text = text.replace('console.warn("Local video autoplay blocked");', '/* Silent fail */')
text = text.replace('console.warn("Screen share cancelled or failed:", err);\n        showKordAlert("Falha na Captura", "Não foi possível compartilhar a sua tela.", "cancel_presentation", "#ef4444");', 'showKordAlert("Compartilhamento Interrompido", "Não foi possível compartilhar a tela.", "cancel_presentation", "#f59e0b");')
text = text.replace('console.warn("SpeechRec Error:", e.error);', 'if (e.error !== "no-speech" && e.error !== "aborted") { showKordAlert("Tradução Interrompida", "O reconhecimento de voz falhou na sua rede.", "translate", "#ef4444"); }')
text = text.replace('console.warn("Whisper transcription error:", e);', 'showKordAlert("Tradutor Offline", "Não foi possível contatar o servidor.", "cloud_off", "#ef4444");')
text = text.replace('console.warn("Audio chunk playback error:", e);', '/* Silent fail playback */')

with open('assets/js/kord_webrtc.js', 'w', encoding='utf-8') as f:
    f.write(text)

print("kord_webrtc patched.")
