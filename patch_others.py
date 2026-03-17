import re

files = [
    'assets/js/kord_auth.js',
    'assets/js/kord_core.js',
    'assets/js/donate.js',
    'assets/js/changelog.js',
    'assets/js/app.js',
    'assets/js/admin_panel.js'
]

replacements = {
    # kord_auth.js
    'currentUser.updateProfile({ photoURL: data.photoURL }).catch(e => console.error(e));': 'currentUser.updateProfile({ photoURL: data.photoURL }).catch(e => { /* Silent Profile Sync Error */ });',
    
    # kord_core.js
    'console.error(\'Fallback copy failed\', err);': 'showKordAlert("Falha ao Copiar", "Não foi possível copiar o texto para sua área de transferência.", "content_copy", "#f59e0b");',
    'console.error("Firebase Key Sync Error:", e);': '/* Silent */',
    'console.error("AI Moderation Error:", e);': '/* Silent */',
    'console.error("[Groq Designer Error]:", e);': 'showKordAlert("Falha na IA", "O Designer Kord está temporariamente indisponível.", "auto_awesome", "#f59e0b");',
    'console.error("Tenor preview error:", e);': '/* Silent */',
    'console.error("[Tenor API Error]:", err);': 'showKordAlert("Falha nos GIFs", "Serviço de busca de GIFs indisponível.", "gif", "#f59e0b");',
    'console.error("[Sticker URL Error]:", dlErr);': '/* Silent */',
    'console.error("[Sticker Upload Error]:", uploadErr);': 'showKordAlert("Erro no Sticker", "Não foi possível enviar a imagem.", "cloud_off", "#ef4444");',
    'console.error("[Sticker Fatal Error]:", e);': 'showKordAlert("Falha Crítica", "Ocorreu um erro ao processar seu Sticker.", "error", "#ef4444");',
    'console.error("[P2P Blob assembler error]:", err);': 'showKordAlert("Erro P2P", "Falha ao montar o arquivo recebido.", "broken_image", "#ef4444");',
    'console.error("Profile Save Error:", err);': 'showKordAlert("Erro ao Salvar", "Suas alterações não puderam ser salvas agora.", "person_off", "#ef4444");',
    'console.error(err);': '/* Handled */',
    'console.error(\'[Translator Error]:\', e);': 'showKordAlert("Tradução Falhou", "O serviço de tradução encontrou um erro.", "translate", "#ef4444");',
    'console.error("PayPal Flow Error:", err);': 'showKordAlert("Erro no PayPal", "A conexão com o servidor de pagamentos falhou.", "payments", "#ef4444");',
    'console.warn("Key Exaurida/Invalida removida do Pool:", keyHash);': '/* Silent pool management */',
    'console.warn("Backend IPN Ping failed silently. Payment is still captured on PayPal.");': '/* Silent API ping */',

    # donate.js
    'console.error(\'Ranking error:\', error);': 'showKordAlert("Ranking Inacessível", "Não foi possível atualizar o Hall da Fama no momento.", "emoji_events", "#f59e0b");',
    
    # changelog.js
    'console.error(\'[Changelog] Error:\', err);': 'showKordAlert("Servidor de Novidades em Manutenção", "O histórico de atualizações não pôde ser carregado.", "update_disabled", "#f59e0b");',
    'console.warn(\'[Changelog] Firebase app not initialized globally.\');': '/* Silent init fail */',
    'console.warn(\'[Changelog] Real-time listener failed:\', e);': '/* Silent listener fail */',
    
    # app.js
    'console.error("[ClickTracker] Track failed:", e);': '/* Silent tracking fail */',
    'console.error("[ClickTracker] getPopular failed:", e);': '/* Silent tracking fetch fail */',
    'console.error("[PopularView] Erro crítico na renderização:", err);': 'showKordAlert("Falha de Renderização", "Alguns itens populares não puderam ser exibidos.", "local_fire_department", "#f59e0b");',
    'console.error("[AccessLogger] Falha ao registrar log:", e);': '/* Silent log fail */',
    'console.error("[Database] Erro fatal:", err);': 'showKordAlert("Desconectado", "O sistema perdeu a conexão primária.", "wifi_off", "#ef4444");',
    'console.error(\'❌ [BugReport] Erro detalhado:\', error);': 'showKordAlert("Falha no Envio", "Seu relatório de bug sofreu uma instabilidade de rede.", "bug_report", "#ef4444");',
    'console.warn("[ClickTracker] Firebase not initialized for tracking");': '/* Silent */',
    'console.warn("[ClickTracker] Firebase not initialized for fetching");': '/* Silent */',
    'console.warn(`[PopularView] Sem correspondência no banco de dados para o ID: ${stat.id}`);': '/* Silent mismatch */',
    'console.warn(\'⚠️ DICA: Verifique se você aplicou as regras do firebase_rules.json no console do Firebase!\');': '/* Silent prod rules */',
    
    # admin_panel.js
    'console.error("[Admin] Firebase fetch error:", e);': '/* Silent / Handled by UI */'
}

for file in files:
    try:
        with open(file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original_content = content
        for old, new in replacements.items():
            content = content.replace(old, new)
            
        if content != original_content:
            with open(file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Patched {file}")
            
    except Exception as e:
        print(f"Skipped {file}: {e}")
