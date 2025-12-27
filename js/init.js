// Inicialização do sistema
let supabaseInitialized = false;

async function initializeApp() {
    try {
        // Configuração do Supabase
        const supabaseUrl = 'https://jvmnttawmrjwkfgjitpe.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2bW50dGF3bXJqd2tmZ2ppdHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ2ODEzNzMsImV4cCI6MjA4MDI1NzM3M30.rzb0wzWE96j7D-gnOX_zS-hmeyerfc7bDmhrEvG2ehE';
        
        // Verifica se a biblioteca Supabase foi carregada
        if (typeof supabase === 'undefined') {
            console.error('Biblioteca Supabase não carregada!');
            showNotification('Erro ao carregar biblioteca do banco de dados', 'error');
            return;
        }
        
        // Inicializa o Supabase
        window.supabase = supabase.createClient(supabaseUrl, supabaseKey);
        supabaseInitialized = true;
        
        console.log('Sistema inicializado com sucesso!');
        
        // Testa a conexão
        await testConnection();
        
        // Dispara evento de inicialização
        document.dispatchEvent(new CustomEvent('supabaseReady'));
        
    } catch (error) {
        console.error('Falha na inicialização:', error);
        showNotification('Erro ao inicializar o sistema: ' + error.message, 'error');
    }
}

async function testConnection() {
    try {
        // Testa a conexão tentando contar produtos
        const { count, error } = await window.supabase
            .from('produtos')
            .select('*', { count: 'exact', head: true });
            
        if (error) {
            console.warn('Aviso na conexão:', error.message);
            // Continua mesmo com erro (tabela pode não existir ainda)
        } else {
            console.log('Conexão com Supabase estabelecida com sucesso!');
        }
    } catch (error) {
        console.warn('Teste de conexão falhou:', error.message);
    }
}

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

// Função para aguardar o Supabase ficar pronto
window.waitForSupabase = function() {
    return new Promise((resolve) => {
        if (window.isSupabaseReady()) {
            resolve();
        } else {
            const checkReady = () => {
                if (window.isSupabaseReady()) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            checkReady();
        }
    });
};