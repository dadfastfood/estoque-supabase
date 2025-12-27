// ============================================
// DASHBOARD - SISTEMA DE ESTOQUE
// ============================================

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

// Variáveis globais
let stockTypeChart = null;
let stockValueChart = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Dashboard inicializando...');
    
    // Aguarda o Supabase ficar pronto
    await waitForSupabase();
    
    if (!window.isSupabaseReady()) {
        console.error('Erro: Supabase não inicializado');
        showNotification('Erro ao conectar com o banco de dados', 'error');
        return;
    }
    
    await loadDashboardData();
    setupEventListeners();
    updateClock();
    setLastUpdateTime();
});

// ============================================
// FUNÇÕES DE SUPORTE
// ============================================

async function waitForSupabase() {
    return new Promise((resolve) => {
        const checkSupabase = () => {
            if (window.supabase) {
                console.log('Supabase conectado');
                resolve();
            } else {
                console.log('Aguardando Supabase...');
                setTimeout(checkSupabase, 100);
            }
        };
        checkSupabase();
    });
}

function setupEventListeners() {
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
        await loadDashboardData();
        setLastUpdateTime();
    }, 60000);
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================

async function loadDashboardData() {
    try {
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
        
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
        showNotification('Erro ao carregar dados do dashboard: ' + error.message, 'error');
    }
}

function showLoadingState() {
    // Atualizar placeholders
    const placeholders = document.querySelectorAll('.stat-value, .big-number, .info-value');
    placeholders.forEach(el => {
        if (!el.textContent || el.textContent === '0') {
            el.textContent = '...';
        }
    });
}

// ============================================
// FUNÇÕES DE CARGA DE DADOS
// ============================================

async function loadProdutos() {
    try {
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
// ATUALIZAÇÃO DA INTERFACE
// ============================================

function updateSummaryCards(produtos, movimentacoesHoje, fornecedores, categorias, depositos) {
    try {
        console.log('Atualizando cards de resumo...');
        
        // Total de produtos
        const totalProdutos = produtos?.length || 0;
        updateElement('total-produtos', totalProdutos);
        
        // Valor total do estoque
        const valorTotal = produtos?.reduce((total, produto) => {
            const precoCusto = parseFloat(produto.preco_custo) || 0;
            const estoqueAtual = parseFloat(produto.estoque_atual) || 0;
            return total + (precoCusto * estoqueAtual);
        }, 0) || 0;
        
        updateElement('valor-total', formatCurrency(valorTotal));
        
        // Produtos com baixo estoque
        const baixoEstoque = produtos?.filter(p => {
            const estoqueMin = parseFloat(p.estoque_minimo) || 0;
            const estoqueAtual = parseFloat(p.estoque_atual) || 0;
            return estoqueAtual <= estoqueMin;
        }).length || 0;
        
        updateElement('baixo-estoque', baixoEstoque);
        
        // Adicionar classe de warning se houver baixo estoque
        const baixoEstoqueEl = document.getElementById('baixo-estoque');
        if (baixoEstoqueEl) {
            baixoEstoqueEl.className = baixoEstoque > 0 ? 'stat-value warning' : 'stat-value';
        }
        
        // Movimentações hoje
        const movHoje = movimentacoesHoje?.length || 0;
        updateElement('mov-hoje', movHoje);
        
        // Total fornecedores
        const totalFornecedores = fornecedores?.length || 0;
        updateElement('total-fornecedores', totalFornecedores);
        
        // Produtos ativos
        const produtosAtivos = produtos?.filter(p => p.ativo !== false).length || 0;
        updateElement('produtos-ativos', produtosAtivos);
        
    } catch (error) {
        console.error('Erro ao atualizar summary cards:', error);
    }
}

function updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = value;
    }
}

async function updateLowStockList() {
    try {
        const container = document.getElementById('low-stock-list');
        if (!container) return;
        
        const produtos = await loadLowStockProducts();
        
        if (!produtos || produtos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>Todos os produtos com estoque adequado</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = produtos.map(produto => {
            const estoqueAtual = parseFloat(produto.estoque_atual) || 0;
            const estoqueMinimo = parseFloat(produto.estoque_minimo) || 0;
            const status = estoqueAtual <= 0 ? 'danger' : 'warning';
            
            return `
                <div class="list-item">
                    <div class="item-info">
                        <div class="item-title">${produto.nome || 'Sem nome'}</div>
                        <div class="item-subtitle">
                            Mínimo: ${estoqueMinimo} ${produto.unidade_medida || ''}
                            ${produto.deposito_nome ? ` | Depósito: ${produto.deposito_nome}` : ''}
                        </div>
                    </div>
                    <div class="item-actions">
                        <span class="stock-value ${status}">
                            ${estoqueAtual}
                        </span>
                        <span class="unit-badge">${produto.unidade_medida || ''}</span>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao atualizar lista de baixo estoque:', error);
        const container = document.getElementById('low-stock-list');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Erro ao carregar dados</p>
                </div>
            `;
        }
    }
}

async function updateRecentMovementsList() {
    try {
        const container = document.getElementById('recent-movements');
        if (!container) return;
        
        const movimentacoes = await loadRecentMovements();
        
        if (!movimentacoes || movimentacoes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exchange-alt"></i>
                    <p>Nenhuma movimentação recente</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = movimentacoes.map(mov => {
            const tipoClass = mov.tipo === 'entrada' ? 'success' : 
                            mov.tipo === 'saida' ? 'danger' : 'warning';
            const tipoIcon = mov.tipo === 'entrada' ? 'fa-arrow-down' : 
                           mov.tipo === 'saida' ? 'fa-arrow-up' : 'fa-exchange-alt';
            
            return `
                <div class="activity-item">
                    <div class="activity-icon ${tipoClass}">
                        <i class="fas ${tipoIcon}"></i>
                    </div>
                    <div class="activity-info">
                        <div class="activity-title">${mov.produto_nome || mov.produtos?.nome || 'Produto'}</div>
                        <div class="activity-details">
                            <span class="badge badge-${tipoClass}">${mov.tipo || ''}</span>
                            <span>${mov.quantidade || 0} ${mov.unidade_medida || mov.produtos?.unidade_medida || ''}</span>
                            <span class="activity-time">${formatDate(mov.created_at)}</span>
                        </div>
                        <div class="activity-subtitle">
                            Operador: ${mov.operador || 'N/A'} 
                            ${mov.observacao ? ` | ${mov.observacao}` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Erro ao atualizar lista de movimentações:', error);
        const container = document.getElementById('recent-movements');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Erro ao carregar movimentações</p>
                </div>
            `;
        }
    }
}

function updateCharts(produtos) {
    try {
        updateStockTypeChart(produtos);
        updateStockValueChart(produtos);
    } catch (error) {
        console.error('Erro ao atualizar gráficos:', error);
    }
}

function updateStockTypeChart(produtos) {
    try {
        const ctx = document.getElementById('stockTypeChart');
        if (!ctx) return;
        
        // Agrupar por unidade de medida
        const porUnidade = produtos?.filter(p => p.unidade_medida === 'unidade') || [];
        const porKg = produtos?.filter(p => p.unidade_medida === 'kg') || [];
        const porOutros = produtos?.filter(p => 
            !['unidade', 'kg'].includes(p.unidade_medida)
        ) || [];
        
        // Destruir gráfico anterior se existir
        if (stockTypeChart) {
            stockTypeChart.destroy();
        }
        
        const chartContext = ctx.getContext('2d');
        stockTypeChart = new Chart(chartContext, {
            type: 'doughnut',
            data: {
                labels: ['Unidades', 'Quilogramas', 'Outros'],
                datasets: [{
                    data: [porUnidade.length, porKg.length, porOutros.length],
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true,
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label;
                                const value = context.raw;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    } catch (error) {
        console.error('Erro ao criar gráfico de tipos:', error);
    }
}

function updateStockValueChart(produtos) {
    try {
        const ctx = document.getElementById('stockValueChart');
        if (!ctx) return;
        
        // Calcular valor total por produto
        const produtosComValor = produtos?.map(p => ({
            nome: p.nome,
            valor: (parseFloat(p.preco_custo) || 0) * (parseFloat(p.estoque_atual) || 0)
        })).filter(p => p.valor > 0)
          .sort((a, b) => b.valor - a.valor)
          .slice(0, 8) || [];
        
        // Destruir gráfico anterior se existir
        if (stockValueChart) {
            stockValueChart.destroy();
        }
        
        const chartContext = ctx.getContext('2d');
        stockValueChart = new Chart(chartContext, {
            type: 'bar',
            data: {
                labels: produtosComValor.map(p => {
                    const nome = p.nome || 'Sem nome';
                    return nome.length > 15 ? nome.substring(0, 15) + '...' : nome;
                }),
                datasets: [{
                    label: 'Valor em Estoque',
                    data: produtosComValor.map(p => p.valor),
                    backgroundColor: '#3b82f6',
                    borderColor: '#2563eb',
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Valor: ${formatCurrency(context.raw)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                if (value >= 1000) {
                                    return 'R$ ' + (value / 1000).toFixed(0) + 'k';
                                }
                                return 'R$ ' + value;
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 10
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erro ao criar gráfico de valores:', error);
    }
}

function updateDetailedInfo(produtos, movimentacoesHoje) {
    try {
        // Atualizar última atualização
        setLastUpdateTime();
        
        // Total produtos detalhado
        updateElement('total-products-detail', produtos?.length || 0);
        
        // Valor total detalhado
        const valorTotal = produtos?.reduce((total, produto) => {
            return total + ((parseFloat(produto.preco_custo) || 0) * (parseFloat(produto.estoque_atual) || 0));
        }, 0) || 0;
        
        updateElement('total-value-detail', formatCurrency(valorTotal));
        
        // Calcular movimentações dos últimos 30 dias
        updateMovimentacoes30Dias();
        
    } catch (error) {
        console.error('Erro ao atualizar informações detalhadas:', error);
    }
}

async function updateMovimentacoes30Dias() {
    try {
        const trintaDiasAtras = new Date();
        trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
        
        const { count, error } = await window.supabase
            .from('movimentacoes')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', trintaDiasAtras.toISOString());
        
        if (!error) {
            updateElement('mov-30-days', count || 0);
        }
    } catch (error) {
        console.error('Erro ao calcular movimentações 30 dias:', error);
    }
}

// ============================================
// FUNÇÕES UTILITÁRIAS
// ============================================

function updateClock() {
    const clockElement = document.getElementById('current-time');
    if (!clockElement) return;
    
    function update() {
        const now = new Date();
        clockElement.textContent = now.toLocaleTimeString('pt-BR');
    }
    
    update();
    setInterval(update, 1000);
}

function setLastUpdateTime() {
    const element = document.getElementById('last-update');
    if (element) {
        const now = new Date();
        element.textContent = now.toLocaleTimeString('pt-BR');
    }
}

// ============================================
// FUNÇÕES GLOBAIS (para uso em outros scripts)
// ============================================

// Torna as funções disponíveis globalmente se não existirem
if (typeof window.formatCurrency === 'undefined') {
    window.formatCurrency = formatCurrency;
}

if (typeof window.formatNumber === 'undefined') {
    window.formatNumber = formatNumber;
}

if (typeof window.formatDate === 'undefined') {
    window.formatDate = formatDate;
}

// Adiciona estilos CSS dinâmicos
function addDashboardStyles() {
    const styles = `
        .stat-value.warning {
            color: #f59e0b !important;
        }
        
        .stat-value.danger {
            color: #ef4444 !important;
        }
        
        .stock-value {
            font-weight: 700;
            font-size: 1.2rem;
        }
        
        .stock-value.warning {
            color: #f59e0b;
        }
        
        .stock-value.danger {
            color: #ef4444;
        }
        
        .unit-badge {
            display: inline-block;
            padding: 2px 8px;
            background: #f3f4f6;
            border-radius: 4px;
            font-size: 0.75rem;
            color: #6b7280;
            margin-left: 4px;
        }
        
        .activity-icon {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            flex-shrink: 0;
        }
        
        .activity-icon.success {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
        }
        
        .activity-icon.danger {
            background: linear-gradient(135deg, #ef4444, #dc2626);
            color: white;
        }
        
        .activity-icon.warning {
            background: linear-gradient(135deg, #f59e0b, #d97706);
            color: white;
        }
        
        .activity-details {
            display: flex;
            gap: 8px;
            align-items: center;
            flex-wrap: wrap;
            margin-top: 4px;
            font-size: 0.875rem;
        }
        
        .activity-time {
            color: #6b7280;
            font-size: 0.8rem;
        }
        
        .empty-state {
            text-align: center;
            padding: 2rem;
            color: #6b7280;
        }
        
        .empty-state i {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.5;
        }
        
        .empty-state.error i {
            color: #ef4444;
        }
        
        .text-muted {
            color: #6b7280;
            font-size: 0.9rem;
        }
        
        .chart-container {
            position: relative;
            height: 250px;
        }
        
        @media (max-width: 768px) {
            .chart-container {
                height: 200px;
            }
        }
    `;
    
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
}

// Inicializar estilos quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDashboardStyles);
} else {
    addDashboardStyles();
}

// Exportar funções principais para uso global
window.dashboard = {
    loadDashboardData,
    updateLowStockList,
    updateRecentMovementsList,
    updateCharts,
    formatCurrency,
    formatNumber,
    formatDate
};

console.log('Dashboard.js carregado com sucesso!');