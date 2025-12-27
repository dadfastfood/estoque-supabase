// Inicialização segura do sistema
let supabaseInitialized = false;
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;

// 🔒 Configuração segura - compatível com navegador e Vercel
function getSupabaseConfig() {
    console.log('Obtendo configuração do Supabase...');
    
    // 1. Tenta variáveis de ambiente injetadas pela Vercel
    // A Vercel injeta variáveis no objeto `window` ou `globalThis`
    const envVars = window.__ENV__ || window.__NEXT_DATA__?.env || {};
    
    // 2. Tenta variáveis específicas
    let supabaseUrl = envVars.VITE_SUPABASE_URL || 
                     window.VITE_SUPABASE_URL || 
                     localStorage.getItem('supabase_url');
    
    let supabaseKey = envVars.VITE_SUPABASE_ANON_KEY || 
                     window.VITE_SUPABASE_ANON_KEY || 
                     localStorage.getItem('supabase_key');
    
    // 3. Para desenvolvimento local (modo mais seguro)
    const isLocal = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1';
    
    if (isLocal) {
        console.log('🔧 Modo desenvolvimento local detectado');
        
        // Tenta carregar do arquivo config.local.js
        if (window.localConfig) {
            console.log('Usando configuração local do config.local.js');
            return {
                url: window.localConfig.supabaseUrl,
                key: window.localConfig.supabaseKey
            };
        }
        
        // Fallback para valores padrão de desenvolvimento
        // ⚠️ ATENÇÃO: Estas são suas credenciais atuais - considere rotacioná-las!
        if (!supabaseUrl || !supabaseKey) {
            console.warn('⚠️ Usando credenciais hardcoded para desenvolvimento');
            return {
                url: 'https://jvmnttawmrjwkfgjitpe.supabase.co',
                key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bW50dGF3bXJqd2tmZ2ppdHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODEzNzMsImV4cCI6MjA4MDI1NzM3M30.rzb0wzWE96j7D-gnOX_zS-hmeyerfc7bDmhrEvG2ehE'
            };
        }
    }
    
    // 4. Para produção (Vercel)
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Configuração não encontrada!');
        console.log('Variáveis disponíveis:', Object.keys(envVars));
        throw new Error('Configuração do Supabase não encontrada. Verifique as variáveis de ambiente.');
    }
    
    // Log parcial para segurança
    console.log('URL configurada:', supabaseUrl.substring(0, 30) + '...');
    console.log('Chave configurada:', supabaseKey.substring(0, 10) + '...');
    
    return { url: supabaseUrl, key: supabaseKey };
}

async function initializeApp() {
    try {
        console.log('🔄 Inicializando sistema de estoque...');
        
        // Mostra estado de carregamento
        showLoadingState('Conectando ao banco de dados...');
        
        // 🔒 Obtém configurações de forma segura
        const config = getSupabaseConfig();
        
        if (!config || !config.url || !config.key) {
            throw new Error('Configuração do banco de dados incompleta.');
        }
        
        // Verifica se a biblioteca Supabase foi carregada
        if (typeof supabase === 'undefined') {
            console.log('Carregando biblioteca Supabase...');
            await loadSupabaseLibrary();
        }
        
        // Inicializa o Supabase
        console.log('Criando cliente Supabase...');
        window.supabase = supabase.createClient(config.url, config.key);
        supabaseInitialized = true;
        
        // Testa a conexão
        console.log('Testando conexão...');
        const isConnected = await testConnection();
        
        if (isConnected) {
            console.log('✅ Sistema inicializado com sucesso!');
            
            // Dispara evento de inicialização
            document.dispatchEvent(new CustomEvent('supabaseReady', {
                detail: { 
                    success: true,
                    timestamp: new Date().toISOString()
                }
            }));
            
            // Esconde loading
            hideLoadingSpinner();
            
            // Mostra app
            showApplication();
            
        } else {
            throw new Error('Conexão estabelecida, mas teste falhou.');
        }
        
    } catch (error) {
        console.error('❌ Falha na inicialização:', error);
        
        // Incrementa tentativas
        connectionAttempts++;
        
        if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
            console.log(`Tentativa ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}...`);
            showLoadingState(`Tentando novamente... (${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})`);
            setTimeout(initializeApp, 2000);
        } else {
            console.error('❌ Todas as tentativas falharam');
            showNotification('Erro crítico: ' + error.message, 'error');
            showFallbackInterface(error.message);
        }
    }
}

async function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
        console.log('📦 Carregando biblioteca Supabase do CDN...');
        
        // Verifica se já está carregado
        if (typeof supabase !== 'undefined') {
            console.log('Biblioteca já carregada');
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
            console.log('✅ Biblioteca Supabase carregada');
            resolve();
        };
        
        script.onerror = (error) => {
            console.error('❌ Falha ao carregar biblioteca:', error);
            reject(new Error('Não foi possível carregar a biblioteca do Supabase'));
        };
        
        document.head.appendChild(script);
    });
}

async function testConnection() {
    try {
        console.log('🔍 Testando conexão com o banco...');
        
        // Tenta uma query simples primeiro
        const { data, error } = await window.supabase
            .from('produtos')
            .select('id')
            .limit(1)
            .maybeSingle(); // Usa maybeSingle para evitar erro se não houver dados
        
        if (error) {
            console.warn('⚠️ Primeiro teste falhou:', error.message);
            
            // Tenta um método mais simples - pegar sessão
            const { error: authError } = await window.supabase.auth.getSession();
            
            if (authError) {
                console.error('❌ Teste de autenticação falhou:', authError.message);
                return false;
            }
            
            console.log('✅ Conexão OK (autenticação funcionando)');
            return true;
        }
        
        console.log('✅ Conexão OK (query funcionando)');
        return true;
        
    } catch (error) {
        console.error('❌ Erro no teste de conexão:', error.message);
        return false;
    }
}

function showLoadingState(message = 'Carregando...') {
    let loadingEl = document.getElementById('loading');
    
    if (!loadingEl) {
        loadingEl = document.createElement('div');
        loadingEl.id = 'loading';
        loadingEl.style.cssText = `
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
            font-family: Arial, sans-serif;
        `;
        
        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 50px;
            height: 50px;
            border: 5px solid #f3f3f3;
            border-top: 5px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-bottom: 20px;
        `;
        
        const text = document.createElement('div');
        text.id = 'loading-text';
        text.style.cssText = `
            color: #333;
            font-size: 16px;
            text-align: center;
        `;
        
        // Adiciona estilos de animação
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        
        loadingEl.appendChild(style);
        loadingEl.appendChild(spinner);
        loadingEl.appendChild(text);
        document.body.appendChild(loadingEl);
    }
    
    const textEl = document.getElementById('loading-text');
    if (textEl) {
        textEl.textContent = message;
    }
}

function hideLoadingSpinner() {
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
        loadingEl.style.opacity = '0';
        loadingEl.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            if (loadingEl.parentNode) {
                loadingEl.parentNode.removeChild(loadingEl);
            }
        }, 300);
    }
}

function showApplication() {
    // Mostra a aplicação principal
    const appElement = document.getElementById('app');
    if (appElement) {
        appElement.style.display = 'block';
    }
    
    // Mostra o conteúdo principal
    const mainElements = document.querySelectorAll('main, header, footer, .container');
    mainElements.forEach(el => {
        if (el.style.display === 'none') {
            el.style.display = '';
        }
    });
}

function showFallbackInterface(errorMessage = '') {
    console.log('Mostrando interface de fallback...');
    
    const fallbackHTML = `
        <div id="error-fallback" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
            <div style="
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(10px);
                border-radius: 20px;
                padding: 40px;
                max-width: 500px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            ">
                <div style="font-size: 80px; margin-bottom: 20px;">
                    ⚠️
                </div>
                
                <h1 style="margin: 0 0 20px 0; font-size: 28px;">
                    Sistema Temporariamente Indisponível
                </h1>
                
                <div style="
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                    padding: 20px;
                    margin: 20px 0;
                    text-align: left;
                ">
                    <p style="margin: 0 0 10px 0;">
                        <strong>O que aconteceu?</strong>
                    </p>
                    <p style="margin: 0 0 15px 0; color: rgba(255, 255, 255, 0.9);">
                        Não foi possível conectar ao banco de dados. Isso pode ser temporário.
                    </p>
                    
                    ${errorMessage ? `
                    <div style="
                        background: rgba(0, 0, 0, 0.3);
                        padding: 10px;
                        border-radius: 5px;
                        margin-top: 10px;
                        font-family: monospace;
                        font-size: 12px;
                        word-break: break-all;
                    ">
                        ${errorMessage}
                    </div>
                    ` : ''}
                </div>
                
                <div style="margin-top: 30px;">
                    <button onclick="location.reload()" style="
                        background: white;
                        color: #667eea;
                        border: none;
                        padding: 15px 30px;
                        border-radius: 50px;
                        font-size: 16px;
                        font-weight: bold;
                        cursor: pointer;
                        margin: 5px;
                        transition: transform 0.2s, box-shadow 0.2s;
                    " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 20px rgba(0,0,0,0.2)'"
                    onmouseout="this.style.transform=''; this.style.boxShadow=''">
                        🔄 Tentar Novamente
                    </button>
                    
                    <button onclick="localStorage.clear(); sessionStorage.clear(); location.reload()" style="
                        background: transparent;
                        color: white;
                        border: 2px solid white;
                        padding: 15px 30px;
                        border-radius: 50px;
                        font-size: 16px;
                        cursor: pointer;
                        margin: 5px;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                    onmouseout="this.style.background='transparent'">
                        🧹 Limpar Cache
                    </button>
                </div>
                
                <div style="margin-top: 30px; font-size: 14px; opacity: 0.8;">
                    <p>Se o problema persistir, entre em contato com o suporte.</p>
                    <p style="font-size: 12px; margin-top: 10px;">
                        Sistema de Estoque • ${new Date().getFullYear()}
                    </p>
                </div>
            </div>
        </div>
    `;
    
    // Remove qualquer fallback existente
    const existing = document.getElementById('error-fallback');
    if (existing) existing.remove();
    
    // Remove loading se existir
    hideLoadingSpinner();
    
    // Adiciona novo fallback
    document.body.insertAdjacentHTML('beforeend', fallbackHTML);
}

// Funções de utilidade
window.showNotification = window.showNotification || function(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
    
    // Remove notificações antigas
    document.querySelectorAll('.temp-notification').forEach(el => el.remove());
    
    const notification = document.createElement('div');
    notification.className = 'temp-notification';
    notification.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: ${type === 'error' ? '#dc3545' : 
                        type === 'success' ? '#28a745' : 
                        type === 'warning' ? '#ffc107' : '#007bff'};
            color: white;
            border-radius: 8px;
            z-index: 10001;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            animation: slideInRight 0.3s ease;
            max-width: 400px;
            word-break: break-word;
            display: flex;
            align-items: center;
        ">
            <span style="margin-right: 10px; font-size: 20px;">
                ${type === 'error' ? '❌' : 
                 type === 'success' ? '✅' : 
                 type === 'warning' ? '⚠️' : 'ℹ️'}
            </span>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
};

// Adiciona estilos de animação se não existirem
if (!document.querySelector('#notification-animations')) {
    const style = document.createElement('style');
    style.id = 'notification-animations';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

// Inicialização
function startApp() {
    // Espera o DOM carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeApp, 100); // Pequeno delay para garantir tudo carregado
        });
    } else {
        setTimeout(initializeApp, 100);
    }
}

// Inicia a aplicação
startApp();

// Funções públicas
window.isSupabaseReady = function() {
    return supabaseInitialized && window.supabase !== undefined;
};

window.waitForSupabase = function(timeout = 15000) {
    return new Promise((resolve, reject) => {
        if (window.isSupabaseReady()) {
            resolve(window.supabase);
            return;
        }
        
        const startTime = Date.now();
        const interval = 100;
        
        const check = () => {
            if (window.isSupabaseReady()) {
                resolve(window.supabase);
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Timeout: Supabase não inicializado em ${timeout}ms`));
            } else {
                setTimeout(check, interval);
            }
        };
        
        check();
    });
};

// Para debug
window.debugSupabase = function() {
    console.log('=== DEBUG Supabase ===');
    console.log('Inicializado:', supabaseInitialized);
    console.log('Cliente disponível:', !!window.supabase);
    console.log('URL config:', getSupabaseConfig()?.url?.substring(0, 30) + '...');
    console.log('====================');
};
