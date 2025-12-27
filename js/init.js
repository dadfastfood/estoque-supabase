// Inicialização segura do sistema
let supabaseInitialized = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// 🔒 Configuração segura - prioriza variáveis de ambiente
function getSupabaseConfig() {
    // 1. Tenta variáveis de ambiente da Vercel (produção)
    const envUrl = window.__ENV__?.VITE_SUPABASE_URL || 
                  process.env?.VITE_SUPABASE_URL;
    
    const envKey = window.__ENV__?.VITE_SUPABASE_ANON_KEY || 
                  process.env?.VITE_SUPABASE_ANON_KEY;
    
    // 2. Tenta buscar de um endpoint seguro (opcional)
    // 3. Fallback para desenvolvimento local seguro
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
        console.log('Modo desenvolvimento local');
        // Para desenvolvimento, você pode usar um arquivo config.local.js
        // que está no .gitignore
        if (typeof window.localConfig !== 'undefined') {
            return {
                url: window.localConfig.supabaseUrl,
                key: window.localConfig.supabaseKey
            };
        }
    }
    
    // 4. Retorna as variáveis de ambiente ou null
    if (envUrl && envKey) {
        return { url: envUrl, key: envKey };
    }
    
    return null;
}

async function initializeApp() {
    try {
        console.log('🔄 Inicializando sistema...');
        
        // 🔒 Obtém configurações de forma segura
        const config = getSupabaseConfig();
        
        if (!config || !config.url || !config.key) {
            throw new Error('Configuração do banco de dados não encontrada. Configure as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
        }
        
        console.log('Configuração carregada para:', config.url.substring(0, 30) + '...');
        
        // Verifica se a biblioteca Supabase foi carregada
        if (typeof supabase === 'undefined') {
            console.error('Biblioteca Supabase não carregada!');
            
            // Tenta carregar dinamicamente
            await loadSupabaseLibrary();
        }
        
        // Inicializa o Supabase
        window.supabase = supabase.createClient(config.url, config.key);
        supabaseInitialized = true;
        
        console.log('✅ Supabase inicializado');
        
        // Testa a conexão
        const isConnected = await testConnection();
        
        if (isConnected) {
            console.log('✅ Sistema inicializado com sucesso!');
            
            // Dispara evento de inicialização
            document.dispatchEvent(new CustomEvent('supabaseReady', {
                detail: { success: true }
            }));
            
            // Esconde loading spinner se existir
            hideLoadingSpinner();
        } else {
            throw new Error('Não foi possível estabelecer conexão com o banco de dados.');
        }
        
    } catch (error) {
        console.error('❌ Falha na inicialização:', error);
        
        // Incrementa tentativas
        connectionAttempts++;
        
        if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
            console.log(`Tentando novamente... (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
            setTimeout(initializeApp, 2000);
        } else {
            showNotification('Erro crítico: ' + error.message, 'error');
            showFallbackInterface();
        }
    }
}

async function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        console.log('Carregando biblioteca Supabase...');
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        script.onload = () => {
            console.log('Biblioteca Supabase carregada');
            resolve();
        };
        script.onerror = () => {
            reject(new Error('Falha ao carregar biblioteca Supabase'));
        };
        
        document.head.appendChild(script);
    });
}

async function testConnection() {
    try {
        console.log('Testando conexão...');
        
        // Teste mais robusto
        const { data, error } = await window.supabase
            .from('produtos')
            .select('count')
            .limit(1)
            .single()
            .catch(() => ({ data: null, error: { message: 'Query error' } }));
        
        if (error) {
            console.warn('⚠️ Aviso na conexão:', error.message);
            // Tenta um teste mais simples
            const { error: simpleError } = await window.supabase.auth.getSession();
            if (simpleError) {
                throw new Error(`Conexão falhou: ${simpleError.message}`);
            }
        }
        
        console.log('✅ Conexão estabelecida');
        return true;
        
    } catch (error) {
        console.error('❌ Teste de conexão falhou:', error.message);
        return false;
    }
}

function hideLoadingSpinner() {
    const loadingElements = [
        document.getElementById('loading'),
        document.querySelector('.loading-spinner'),
        document.querySelector('[data-loading]')
    ];
    
    loadingElements.forEach(el => {
        if (el) {
            el.style.display = 'none';
            el.remove();
        }
    });
}

function showFallbackInterface() {
    console.log('Mostrando interface de fallback...');
    
    // Cria ou atualiza interface de erro
    const fallbackHTML = `
        <div class="error-container" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            padding: 20px;
            text-align: center;
        ">
            <div style="max-width: 500px;">
                <h1 style="color: #dc3545; margin-bottom: 20px;">
                    ⚠️ Sistema Indisponível
                </h1>
                
                <div style="
                    background: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 20px;
                ">
                    <p>O sistema não conseguiu se conectar ao banco de dados.</p>
                    <p><strong>Possíveis causas:</strong></p>
                    <ul style="text-align: left; display: inline-block;">
                        <li>Problemas de conexão com a internet</li>
                        <li>Servidor do banco de dados indisponível</li>
                        <li>Configuração incorreta do sistema</li>
                    </ul>
                </div>
                
                <div>
                    <button onclick="location.reload()" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                        margin: 5px;
                    ">
                        Tentar Novamente
                    </button>
                    
                    <button onclick="localStorage.clear(); location.reload()" style="
                        background: #6c757d;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 16px;
                        margin: 5px;
                    ">
                        Limpar Cache e Tentar
                    </button>
                </div>
                
                <p style="margin-top: 30px; color: #6c757d; font-size: 14px;">
                    Se o problema persistir, entre em contato com o suporte técnico.
                    <br>
                    <small>Erro: Falha na conexão com o banco de dados</small>
                </p>
            </div>
        </div>
    `;
    
    const existingError = document.querySelector('.error-container');
    if (!existingError) {
        document.body.insertAdjacentHTML('beforeend', fallbackHTML);
    }
}

// Helper function (se não existir)
window.showNotification = window.showNotification || function(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Cria notificação simples se não houver sistema de notificações
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#007bff'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 5000);
    
    // Adiciona estilos CSS se não existirem
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
};

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Função para verificar se o sistema está pronto
window.isSupabaseReady = function() {
    return supabaseInitialized && window.supabase !== undefined;
};

// Função melhorada para aguardar o Supabase
window.waitForSupabase = function(timeout = 10000) {
    return new Promise((resolve, reject) => {
        if (window.isSupabaseReady()) {
            resolve(window.supabase);
            return;
        }
        
        const startTime = Date.now();
        const checkInterval = 100;
        
        const checkReady = () => {
            if (window.isSupabaseReady()) {
                resolve(window.supabase);
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Timeout após ${timeout}ms aguardando Supabase`));
            } else {
                setTimeout(checkReady, checkInterval);
            }
        };
        
        checkReady();
    });
};

// Exporta para uso em outros módulos
window.initializeApp = initializeApp;
