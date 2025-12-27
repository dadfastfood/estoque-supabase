// ============================================
// DASHBOARD - SISTEMA DE ESTOQUE
// ============================================

// Variáveis globais
let stockTypeChart = null;
let stockValueChart = null;
let dashboardInitialized = false;

// Funções de formatação (para evitar erros de referência)
const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
};

const formatNumber = (value, decimals = 2) => {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value || 0);
};

const formatDate = (dateString) => {
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Data inválida';
        
        return date.toLocaleDateString('pt-BR') + ' ' + 
               date.toLocaleTimeString('pt-BR', { 
                   hour: '2-digit', 
                   minute: '2-digit' 
               });
    } catch (error) {
        return 'Data inválida';
    }
};

// ============================================
// INICIALIZAÇÃO DO DASHBOARD
// ============================================

// Função principal de inicialização
async function initializeDashboard() {
    console.log('📊 Inicializando dashboard...');
    
    try {
        // Aguarda o Supabase ficar pronto
        await waitForSupabase();
        
        if (!window.supabase) {
            throw new Error('Supabase não inicializado');
        }
        
        // Carrega os dados do dashboard
        await loadDashboardData();
        
        // Configura os listeners de eventos
        setupEventListeners();
        
        // Inicia funcionalidades de tempo
        updateClock();
        setLastUpdateTime();
        
        // Marca como inicializado
        dashboardInitialized = true;
        
        console.log('✅ Dashboard inicializado com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro ao inicializar dashboard:', error);
        showDashboardError('Erro ao carregar dashboard: ' + error.message);
    }
}

// Aguarda o DOM e o Supabase estarem prontos
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard DOM carregado, aguardando Supabase...');
    
    // Se já houver um evento supabaseReady, inicia imediatamente
    if (window.supabase) {
        console.log('Supabase já está disponível');
        initializeDashboard();
    } else {
        // Aguarda o evento supabaseReady
        document.addEventListener('supabaseReady', () => {
            console.log('Evento supabaseReady recebido');
            setTimeout(initializeDashboard, 100); // Pequeno delay
        });
        
        // Timeout de segurança
        setTimeout(() => {
            if (!dashboardInitialized && window.supabase) {
                console.log('Inicializando dashboard por timeout...');
                initializeDashboard();
            }
        }, 5000);
    }
});

// ============================================
// FUNÇÕES DE SUPORTE
// ============================================

async function waitForSupabase() {
    console.log('Aguardando Supabase...');
    
    return new Promise((resolve, reject) => {
        const maxWaitTime = 10000; // 10 segundos
        const startTime = Date.now();
        
        const checkSupabase = () => {
            const elapsed = Date.now() - startTime;
            
            if (window.supabase && window.supabaseInitialized !== false) {
                console.log('✅ Supabase conectado');
                resolve();
            } else if (elapsed > maxWaitTime) {
                reject(new Error('Timeout: Supabase não inicializado após 10 segundos'));
            } else {
                // Verifica se existe a função waitForSupabase global
                if (typeof window.waitForSupabase === 'function') {
                    window.waitForSupabase(5000)
                        .then(resolve)
                        .catch(() => setTimeout(checkSupabase, 100));
                } else {
                    setTimeout(checkSupabase, 100);
                }
            }
        };
        
        checkSupabase();
    });
}

function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Botão atualizar
    const btnAtualizar = document.getElementById('btnAtualizar');
    if (btnAtualizar) {
        btnAtualizar.addEventListener('click', async () => {
            btnAtualizar.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
            btnAtualizar.disabled = true;
            
            await loadDashboardData();
            setLastUpdateTime();
            
            btnAtualizar.innerHTML = '<i class="fas fa-sync-alt"></i> Atualizar';
            btnAtualizar.disabled = false;
            showNotification('Dashboard atualizado com sucesso!', 'success');
        });
    }
    
    // Filtro de período do gráfico
    const chartPeriod = document.getElementById('chartPeriod');
    if (chartPeriod) {
        chartPeriod.addEventListener('change', () => {
            loadDashboardData();
        });
    }
    
    // Atualizar automaticamente a cada 60 segundos
    setInterval(async () => {
        if (dashboardInitialized) {
            await loadDashboardData();
            setLastUpdateTime();
        }
    }, 60000);
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function loadDashboardData() {
    try {
        if (!window.supabase) {
            throw new Error('Supabase não disponível');
        }
        
        console.log('Carregando dados do dashboard...');
        showLoadingState();
        
        // Carregar dados em paralelo
        const [
            produtos,
            movimentacoesHoje,
            fornecedores,
            categorias,
            depositos
        ] = await Promise.all([
            loadProdutos(),
            loadMovimentacoesHoje(),
            loadFornecedores(),
            loadCategorias(),
            loadDepositos()
        ]);
        
        console.log('Dados carregados:', {
            produtos: produtos?.length,
            movimentacoesHoje: movimentacoesHoje?.length,
            fornecedores: fornecedores?.length,
            categorias: categorias?.length,
            depositos: depositos?.length
        });
        
        // Atualizar componentes
        updateSummaryCards(produtos, movimentacoesHoje, fornecedores, categorias, depositos);
        await updateLowStockList();
        await updateRecentMovementsList();
        updateCharts(produtos);
        
        // Atualizar informações detalhadas
        updateDetailedInfo(produtos, movimentacoesHoje);
        
        // Esconde estado de loading
        hideLoadingState();
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showNotification('Erro ao carregar dados do dashboard: ' + error.message, 'error');
        showDashboardError(error.message);
    }
}

function showLoadingState() {
    // Adiciona ou atualiza o estado de loading
    const loadingElement = document.getElementById('dashboard-loading');
    if (loadingElement) {
        loadingElement.style.display = 'flex';
        return;
    }
    
    // Cria o elemento de loading se não existir
    const loadingHTML = `
        <div id="dashboard-loading" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9998;
            font-family: Arial, sans-serif;
        ">
            <div style="
                width: 50px;
                height: 50px;
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 15px;
            "></div>
            <div style="color: #333; font-size: 14px;">Carregando dados...</div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
    
    // Adiciona a animação se não existir
    if (!document.querySelector('#dashboard-spinner-animation')) {
        const style = document.createElement('style');
        style.id = 'dashboard-spinner-animation';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function hideLoadingState() {
    const loadingElement = document.getElementById('dashboard-loading');
    if (loadingElement) {
        loadingElement.style.opacity = '0';
        loadingElement.style.transition = 'opacity 0.3s';
        setTimeout(() => {
            if (loadingElement.parentNode) {
                loadingElement.parentNode.removeChild(loadingElement);
            }
        }, 300);
    }
}

function showDashboardError(message) {
    // Remove qualquer erro existente
    const existingError = document.getElementById('dashboard-error');
    if (existingError) existingError.remove();
    
    // Cria mensagem de erro
    const errorHTML = `
        <div id="dashboard-error" style="
            background: #fee;
            border: 1px solid #fcc;
            border-radius: 8px;
            padding: 15px;
            margin: 15px;
            color: #c00;
            font-family: Arial, sans-serif;
        ">
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <i class="fas fa-exclamation-triangle" style="margin-right: 10px; font-size: 20px;"></i>
                <strong style="font-size: 16px;">Erro no Dashboard</strong>
            </div>
            <div style="font-size: 14px; margin-bottom: 10px;">${message}</div>
            <button onclick="retryDashboard()" style="
                background: #c00;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
            ">
                <i class="fas fa-redo"></i> Tentar Novamente
            </button>
        </div>
    `;
    
    // Insere no topo do conteúdo principal
    const mainContent = document.querySelector('main') || 
                       document.querySelector('.container') || 
                       document.body;
    
    // Tenta encontrar um lugar apropriado para inserir
    const firstCard = mainContent.querySelector('.card, .dashboard-card, .stat-card');
    if (firstCard) {
        firstCard.insertAdjacentHTML('beforebegin', errorHTML);
    } else {
        mainContent.insertAdjacentHTML('afterbegin', errorHTML);
    }
}

// Função de retry global
window.retryDashboard = async function() {
    const errorElement = document.getElementById('dashboard-error');
    if (errorElement) errorElement.remove();
    
    await loadDashboardData();
};

// ============================================
// FUNÇÕES DE CARGA DE DADOS (mantenha as existentes)
// ============================================

async function loadProdutos() {
    try {
        if (!window.supabase) throw new Error('Supabase não disponível');
        
        const { data, error } = await window.supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('nome');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        return [];
    }
}

async function loadMovimentacoesHoje() {
    try {
        if (!window.supabase) throw new Error('Supabase não disponível');
        
        const hoje = new Date().toISOString().split('T')[0];
        const { data, error } = await window.supabase
            .from('movimentacoes')
            .select('*')
            .gte('created_at', hoje + 'T00:00:00')
            .lte('created_at', hoje + 'T23:59:59')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar movimentações de hoje:', error);
        return [];
    }
}

async function loadFornecedores() {
    try {
        if (!window.supabase) throw new Error('Supabase não disponível');
        
        const { data, error } = await window.supabase
            .from('fornecedores')
            .select('*')
            .eq('ativo', true)
            .order('nome');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar fornecedores:', error);
        return [];
    }
}

async function loadCategorias() {
    try {
        if (!window.supabase) throw new Error('Supabase não disponível');
        
        const { data, error } = await window.supabase
            .from('categorias')
            .select('*')
            .eq('ativo', true)
            .order('nome');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        return [];
    }
}

async function loadDepositos() {
    try {
        if (!window.supabase) throw new Error('Supabase não disponível');
        
        const { data, error } = await window.supabase
            .from('depositos')
            .select('*')
            .eq('ativo', true)
            .order('nome');
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar depósitos:', error);
        return [];
    }
}

async function loadLowStockProducts() {
    try {
        if (!window.supabase) throw new Error('Supabase não disponível');
        
        const { data, error } = await window.supabase
            .from('view_produtos_baixo_estoque')
            .select('*')
            .limit(10);
        
        if (error) {
            // Fallback se a view não existir
            const { data: produtos, error: produtosError } = await window.supabase
                .from('produtos')
                .select('*')
                .eq('ativo', true)
                .order('estoque_atual', { ascending: true })
                .limit(10);
            
            if (produtosError) throw produtosError;
            
            // Filtrar produtos com estoque baixo
            return produtos.filter(p => 
                p.estoque_atual <= (p.estoque_minimo || 0)
            );
        }
        
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar produtos com baixo estoque:', error);
        return [];
    }
}

async function loadRecentMovements() {
    try {
        if (!window.supabase) throw new Error('Supabase não disponível');
        
        // Tentar usar a view primeiro
        const { data, error } = await window.supabase
            .from('view_movimentacoes_detalhadas')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) {
            console.warn('View não disponível, usando fallback:', error.message);
            return await loadRecentMovementsFallback();
        }
        
        return data || [];
    } catch (error) {
        console.error('Erro ao carregar movimentações recentes:', error);
        return [];
    }
}

async function loadRecentMovementsFallback() {
    try {
        if (!window.supabase) throw new Error('Supabase não disponível');
        
        const { data: movimentacoes, error } = await window.supabase
            .from('movimentacoes')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (!movimentacoes || movimentacoes.length === 0) return [];
        
        // Buscar informações dos produtos
        const produtoIds = [...new Set(movimentacoes.map(m => m.produto_id))];
        const { data: produtos } = await window.supabase
            .from('produtos')
            .select('id, nome, unidade_medida')
            .in('id', produtoIds);
        
        const produtosMap = {};
        produtos?.forEach(p => {
            produtosMap[p.id] = p;
        });
        
        // Combinar dados
        return movimentacoes.map(mov => ({
            ...mov,
            produto_nome: produtosMap[mov.produto_id]?.nome || 'Produto não encontrado',
            unidade_medida: produtosMap[mov.produto_id]?.unidade_medida || '',
            deposito_origem: 'N/A',
            deposito_destino: 'N/A'
        }));
    } catch (error) {
        console.error('Erro no fallback de movimentações:', error);
        return [];
    }
}

// ============================================
// RESTANTE DO CÓDIGO (mantenha tudo a partir da linha 200)
// ============================================

// ... (COLE AQUI TODO O RESTANTE DO SEU CÓDIGO A PARTIR DA LINHA 200)
// Isso inclui:
// - updateSummaryCards
// - updateElement
// - updateLowStockList
// - updateRecentMovementsList
// - updateCharts
// - updateStockTypeChart
// - updateStockValueChart
// - updateDetailedInfo
// - updateMovimentacoes30Dias
// - updateClock
// - setLastUpdateTime
// - addDashboardStyles
// - E as exportações finais

console.log('✅ Dashboard.js carregado e pronto para inicialização');
