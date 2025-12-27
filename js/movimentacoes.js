// Variáveis globais
let produtos = [];

// Esperar o DOM carregar
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Inicializando sistema de movimentações...');
    
    // Aguardar Supabase
    await window.waitForSupabase();
    
    if (!window.isSupabaseReady()) {
        showNotification('Erro: Sistema não inicializado', 'error');
        return;
    }
    
    console.log('Supabase inicializado com sucesso');
    
    try {
        // Carregar dependências
        await loadDependencies();
        await loadMovimentacoes();
        setupEventListeners();
        setupFilters();
        
        // Verificar se há produto específico na URL
        const urlParams = new URLSearchParams(window.location.search);
        const produtoId = urlParams.get('produto');
        if (produtoId) {
            document.getElementById('produto_id').value = produtoId;
            document.getElementById('filterProduto').value = produtoId;
        }
        
        console.log('Sistema de movimentações inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar sistema de movimentações:', error);
        showNotification('Erro ao inicializar o sistema', 'error');
    }
});

// Carregar produtos
async function loadDependencies() {
    try {
        console.log('Carregando produtos...');
        
        const { data, error } = await window.supabase
            .from('produtos')
            .select('id, nome, unidade_medida, estoque_atual')
            .order('nome');
        
        if (error) {
            console.error('Erro ao buscar produtos:', error);
            throw error;
        }
        
        produtos = data || [];
        console.log(`${produtos.length} produtos carregados`);
        
        // Log de todos os produtos para debug
        produtos.forEach(prod => {
            console.log(`Produto: ${prod.nome}, Estoque: ${prod.estoque_atual}, ID: ${prod.id}`);
        });
        
        populateSelects();
    } catch (error) {
        console.error('Erro ao carregar produtos:', error);
        showNotification('Erro ao carregar produtos', 'error');
    }
}

// Popular selects
function populateSelects() {
    // Select de produtos (formulário)
    const produtoSelect = document.getElementById('produto_id');
    if (produtoSelect) {
        produtoSelect.innerHTML = '<option value="">Selecione um produto...</option>' +
            produtos.map(prod => 
                `<option value="${prod.id}" data-estoque="${prod.estoque_atual}">
                    ${prod.nome} (${prod.unidade_medida}) - Estoque: ${prod.estoque_atual}
                </option>`
            ).join('');
    }
    
    // Select de filtro por produto
    const filterProdutoSelect = document.getElementById('filterProduto');
    if (filterProdutoSelect) {
        filterProdutoSelect.innerHTML = '<option value="">Todos os produtos</option>' +
            produtos.map(prod => 
                `<option value="${prod.id}">${prod.nome} - Estoque: ${prod.estoque_atual}</option>`
            ).join('');
    }
}

// Configurar event listeners
function setupEventListeners() {
    // Formulário
    document.getElementById('movimentacaoForm').addEventListener('submit', handleSubmit);
    
    // Botão limpar
    document.getElementById('btnLimpar').addEventListener('click', () => {
        resetForm('movimentacaoForm');
    });
    
    // Quando produto é selecionado, mostrar estoque atual
    document.getElementById('produto_id').addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        const estoqueAtual = selectedOption.getAttribute('data-estoque');
        
        if (estoqueAtual) {
            document.getElementById('estoqueAtual').textContent = estoqueAtual;
            document.getElementById('estoqueInfo').style.display = 'block';
        } else {
            document.getElementById('estoqueInfo').style.display = 'none';
        }
    });
}

// Configurar filtros
function setupFilters() {
    // Event listeners para filtros
    document.getElementById('filterProduto').addEventListener('change', loadMovimentacoes);
    document.getElementById('filterTipo').addEventListener('change', loadMovimentacoes);
    document.getElementById('filterDataInicio').addEventListener('change', loadMovimentacoes);
    document.getElementById('filterDataFim').addEventListener('change', loadMovimentacoes);
    
    // Botão limpar filtros
    document.getElementById('btnLimparFiltros').addEventListener('click', () => {
        document.getElementById('filterProduto').value = '';
        document.getElementById('filterTipo').value = '';
        document.getElementById('filterDataInicio').value = '';
        document.getElementById('filterDataFim').value = '';
        loadMovimentacoes();
    });
}

// Carregar movimentações
async function loadMovimentacoes() {
    try {
        console.log('Carregando movimentações...');
        
        let query = window.supabase
            .from('movimentacoes')
            .select(`
                *,
                produtos(nome, unidade_medida)
            `)
            .order('created_at', { ascending: false });

        // Aplicar filtros
        const produtoId = document.getElementById('filterProduto').value;
        const tipo = document.getElementById('filterTipo').value;
        const dataInicio = document.getElementById('filterDataInicio').value;
        const dataFim = document.getElementById('filterDataFim').value;

        if (produtoId) {
            query = query.eq('produto_id', produtoId);
        }
        
        if (tipo) {
            query = query.eq('tipo', tipo);
        }
        
        if (dataInicio) {
            const startDate = new Date(dataInicio);
            query = query.gte('created_at', startDate.toISOString());
        }
        
        if (dataFim) {
            const endDate = new Date(dataFim);
            endDate.setDate(endDate.getDate() + 1);
            query = query.lt('created_at', endDate.toISOString());
        }

        const { data: movimentacoes, error } = await query;

        if (error) {
            console.error('Erro ao buscar movimentações:', error);
            throw error;
        }

        console.log(`${movimentacoes.length} movimentações carregadas`);
        renderMovimentacoesTable(movimentacoes);
    } catch (error) {
        console.error('Erro ao carregar movimentações:', error);
        showNotification('Erro ao carregar movimentações', 'error');
    }
}

// Renderizar tabela de movimentações
function renderMovimentacoesTable(movimentacoes) {
    const tbody = document.getElementById('movimentacoesTable');
    
    if (!movimentacoes || movimentacoes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-exchange-alt"></i>
                    <p>Nenhuma movimentação encontrada</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = movimentacoes.map(mov => {
        const produto = mov.produtos;
        const tipoClass = getTipoClass(mov.tipo);
        const tipoText = getTipoText(mov.tipo);
        const tipoIcon = getTipoIcon(mov.tipo);
        
        // Calcular saldo (positivo para entradas, negativo para saídas)
        const saldo = mov.tipo === 'entrada' ? 
            `<span class="text-success">+${mov.quantidade}</span>` : 
            `<span class="text-danger">-${mov.quantidade}</span>`;
        
        return `
            <tr>
                <td>${formatDate(mov.created_at)}</td>
                <td>
                    <strong>${produto?.nome || 'Produto não encontrado'}</strong>
                </td>
                <td>
                    <span class="badge ${tipoClass}">
                        <i class="fas ${tipoIcon}"></i> ${tipoText}
                    </span>
                </td>
                <td class="text-center">${saldo}</td>
                <td class="text-right">
                    <strong>${mov.quantidade}</strong>
                    <span class="unit-badge">${produto?.unidade_medida || ''}</span>
                </td>
                <td>${mov.operador || 'Sistema'}</td>
                <td>${mov.observacao || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button onclick="deleteMovimentacao('${mov.id}', '${produto?.nome || ''}')" 
                                class="btn btn-sm btn-danger" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Funções auxiliares
function getTipoClass(tipo) {
    const classes = {
        entrada: 'badge-success',
        saida: 'badge-danger',
        venda: 'badge-warning',
        uso: 'badge-info',
        avaria: 'badge-dark'
    };
    return classes[tipo] || 'badge-secondary';
}

function getTipoText(tipo) {
    const textos = {
        entrada: 'Entrada',
        saida: 'Saída',
        venda: 'Venda',
        uso: 'Uso Interno',
        avaria: 'Avarias'
    };
    return textos[tipo] || tipo;
}

function getTipoIcon(tipo) {
    const icons = {
        entrada: 'fa-boxes',
        saida: 'fa-user-check',
        venda: 'fa-shopping-cart',
        uso: 'fa-tools',
        avaria: 'fa-exclamation-triangle'
    };
    return icons[tipo] || 'fa-exchange-alt';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR').slice(0, 5);
}

// Validar formulário
function validateForm(formId) {
    const form = document.getElementById(formId);
    const requiredInputs = form.querySelectorAll('[required]');
    let isValid = true;

    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('is-invalid');
            isValid = false;
        } else {
            input.classList.remove('is-invalid');
        }
    });

    // Validação especial para quantidade
    const quantidadeInput = document.getElementById('quantidade');
    if (quantidadeInput && parseFloat(quantidadeInput.value) <= 0) {
        quantidadeInput.classList.add('is-invalid');
        showNotification('A quantidade deve ser maior que zero', 'warning');
        isValid = false;
    }

    return isValid;
}

// Resetar formulário
function resetForm(formId) {
    const form = document.getElementById(formId);
    form.reset();
    form.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.getElementById('estoqueInfo').style.display = 'none';
}

// Manipular envio do formulário
async function handleSubmit(event) {
    event.preventDefault();
    
    if (!validateForm('movimentacaoForm')) {
        return;
    }
    
    const tipo = document.getElementById('tipo').value;
    const produtoId = document.getElementById('produto_id').value;
    const quantidade = parseFloat(document.getElementById('quantidade').value);
    const operador = document.getElementById('operador').value.trim();
    const observacao = document.getElementById('observacao').value.trim();
    
    console.log(`=== INICIANDO REGISTRO DE MOVIMENTAÇÃO ===`);
    console.log(`Tipo: ${tipo}, Produto ID: ${produtoId}, Quantidade: ${quantidade}`);
    
    // Verificar se é saída e se há estoque suficiente
    if (tipo !== 'entrada') {
        try {
            console.log(`Verificando estoque para produto ${produtoId}...`);
            
            // Buscar o produto selecionado
            const { data: produto, error: produtoError } = await window.supabase
                .from('produtos')
                .select('estoque_atual, nome, unidade_medida')
                .eq('id', produtoId)
                .single();
                
            if (produtoError) {
                console.error('Erro ao buscar produto:', produtoError);
                throw produtoError;
            }
            
            if (!produto) {
                showNotification('Produto não encontrado', 'error');
                return;
            }
            
            console.log(`Estoque atual do produto "${produto.nome}": ${produto.estoque_atual} ${produto.unidade_medida}`);
            
            if (produto.estoque_atual < quantidade) {
                showNotification(
                    `Estoque insuficiente! ${produto.nome} tem apenas ${produto.estoque_atual} ${produto.unidade_medida} disponíveis`,
                    'error'
                );
                return;
            }
            
            // Para vendas, confirmar
            if (tipo === 'venda') {
                const confirmarVenda = confirm(
                    `Registrar venda de ${quantidade} ${produto.unidade_medida} de ${produto.nome}?\n` +
                    `Estoque antes: ${produto.estoque_atual}\n` +
                    `Estoque após: ${produto.estoque_atual - quantidade}`
                );
                
                if (!confirmarVenda) {
                    return;
                }
            }
            
            console.log(`Estoque verificado: ${produto.estoque_atual} disponíveis`);
            
        } catch (error) {
            console.error('Erro ao verificar estoque:', error);
            showNotification('Erro ao verificar estoque do produto', 'error');
            return;
        }
    }
    
    // Preparar dados da movimentação
    const movimentacao = {
        produto_id: produtoId,
        tipo: tipo,
        quantidade: quantidade,
        operador: operador,
        observacao: observacao || null
    };
    
    console.log('Registrando movimentação:', movimentacao);
    
    try {
        // VERIFICAÇÃO EXTRA: Buscar o estoque atual ANTES de fazer qualquer cálculo
        console.log('Buscando estoque atual antes da atualização...');
        const { data: produtoAntes, error: fetchAntesError } = await window.supabase
            .from('produtos')
            .select('estoque_atual, nome')
            .eq('id', produtoId)
            .single();
            
        if (fetchAntesError) {
            console.error('Erro ao buscar estoque antes:', fetchAntesError);
            throw fetchAntesError;
        }
        
        console.log(`ESTOQUE ANTES DA ATUALIZAÇÃO: ${produtoAntes.estoque_atual} (${produtoAntes.nome})`);
        
        // Inserir movimentação
        const { error: insertError } = await window.supabase
            .from('movimentacoes')
            .insert([movimentacao]);
            
        if (insertError) {
            console.error('Erro ao inserir movimentação:', insertError);
            throw insertError;
        }
        
        console.log('Movimentação inserida com sucesso no banco de dados');
        
        // Atualizar estoque do produto - Método corrigido
        let ajusteEstoque;
        
        if (tipo === 'entrada') {
            // Entrada: aumenta o estoque
            ajusteEstoque = quantidade;
        } else {
            // Todas as outras (saida, venda, uso, avaria): diminuem o estoque
            ajusteEstoque = -quantidade;
        }
        
        console.log(`Ajuste de estoque: ${ajusteEstoque} (${tipo})`);
        
        // Calcular novo estoque
        const novoEstoque = parseFloat(produtoAntes.estoque_atual) + ajusteEstoque;
        
        console.log(`CÁLCULO: ${produtoAntes.estoque_atual} ${ajusteEstoque > 0 ? '+' : ''} ${ajusteEstoque} = ${novoEstoque}`);
        
        // Atualizar com o novo valor
        console.log('Atualizando estoque no banco de dados...');
        const { error: updateError } = await window.supabase
            .from('produtos')
            .update({ 
                estoque_atual: novoEstoque
            })
            .eq('id', produtoId);
            
        if (updateError) {
            console.error('Erro ao atualizar estoque:', updateError);
            throw updateError;
        }
        
        // Sucesso!
        showNotification(`${getTipoText(tipo)} de ${quantidade} unidade(s) registrada com sucesso!`, 'success');
        
        // Atualizar interface
        resetForm('movimentacaoForm');
        await loadDependencies(); // Recarrega produtos para atualizar estoque
        await loadMovimentacoes();
        
        // Atualizar dashboard se estiver na mesma sessão
        if (typeof loadDashboardData === 'function') {
            setTimeout(loadDashboardData, 1000);
        }
        
        console.log('=== MOVIMENTAÇÃO REGISTRADA COM SUCESSO ===\n');
        
    } catch (error) {
        console.error('Erro ao registrar movimentação:', error);
        showNotification('Erro ao registrar movimentação: ' + error.message, 'error');
    }
}

// Excluir movimentação
async function deleteMovimentacao(id, produtoNome) {
    if (!confirm(`Tem certeza que deseja excluir esta movimentação de ${produtoNome || 'produto'}?\n\nEsta ação reverterá o estoque.`)) {
        return;
    }
    
    try {
        console.log(`=== INICIANDO EXCLUSÃO DE MOVIMENTAÇÃO ===`);
        console.log(`ID da movimentação: ${id}`);
        
        // Primeiro, buscar a movimentação para obter os dados
        const { data: movimentacao, error: fetchError } = await window.supabase
            .from('movimentacoes')
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchError) {
            console.error('Erro ao buscar movimentação:', fetchError);
            throw fetchError;
        }
        
        console.log(`Movimentação encontrada: Tipo: ${movimentacao.tipo}, Quantidade: ${movimentacao.quantidade}, Produto ID: ${movimentacao.produto_id}`);
        
        // VERIFICAÇÃO EXTRA: Buscar estoque atual antes da exclusão
        console.log('Buscando estoque atual antes da reversão...');
        const { data: produtoAntes, error: fetchAntesError } = await window.supabase
            .from('produtos')
            .select('estoque_atual, nome')
            .eq('id', movimentacao.produto_id)
            .single();
            
        if (fetchAntesError) {
            console.error('Erro ao buscar estoque antes:', fetchAntesError);
            throw fetchAntesError;
        }
        
        console.log(`ESTOQUE ANTES DA REVERSÃO: ${produtoAntes.estoque_atual} (${produtoAntes.nome})`);
        
        // Reverter o estoque
        let ajuste;
        
        if (movimentacao.tipo === 'entrada') {
            // Se era uma entrada, ao excluir devemos SUBTRAIR do estoque
            ajuste = -movimentacao.quantidade;
        } else {
            // Se era uma saída (saida, venda, uso, avaria), ao excluir devemos SOMAR ao estoque
            ajuste = movimentacao.quantidade;
        }
        
        console.log(`Ajuste para reversão: ${ajuste}`);
        
        // Calcular novo estoque
        const novoEstoque = parseFloat(produtoAntes.estoque_atual) + ajuste;
        
        console.log(`CÁLCULO DA REVERSÃO: ${produtoAntes.estoque_atual} ${ajuste > 0 ? '+' : ''} ${ajuste} = ${novoEstoque}`);
        
        // Atualizar estoque
        console.log('Atualizando estoque no banco de dados...');
        const { error: updateError } = await window.supabase
            .from('produtos')
            .update({ 
                estoque_atual: novoEstoque
            })
            .eq('id', movimentacao.produto_id);
            
        if (updateError) {
            console.error('Erro ao reverter estoque:', updateError);
            throw updateError;
        }
        
        // Excluir a movimentação
        console.log('Excluindo movimentação do banco de dados...');
        const { error: deleteError } = await window.supabase
            .from('movimentacoes')
            .delete()
            .eq('id', id);
            
        if (deleteError) {
            console.error('Erro ao excluir movimentação:', deleteError);
            throw deleteError;
        }
        
        showNotification('Movimentação excluída com sucesso! Estoque revertido.', 'success');
        
        // Atualizar interface
        await loadDependencies();
        await loadMovimentacoes();
        
        // Atualizar dashboard se estiver na mesma sessão
        if (typeof loadDashboardData === 'function') {
            setTimeout(loadDashboardData, 1000);
        }
        
        console.log('=== MOVIMENTAÇÃO EXCLUÍDA COM SUCESSO ===\n');
        
    } catch (error) {
        console.error('Erro ao excluir movimentação:', error);
        showNotification('Erro ao excluir movimentação', 'error');
    }
}

// Mostrar notificação
function showNotification(message, type = 'info') {
    // Remover notificações anteriores
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notif => notif.remove());
    
    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remover após 5 segundos
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transition = 'all 0.3s ease';
            notification.style.transform = 'translateX(100%)';
            notification.style.opacity = '0';
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

// FUNÇÃO PARA CORRIGIR ESTOQUE NO BANCO DE DADOS
async function corrigirEstoque(produtoId, novoEstoque, motivo = "Correção manual") {
    try {
        console.log(`=== CORREÇÃO DE ESTOQUE ===`);
        console.log(`Produto ID: ${produtoId}`);
        console.log(`Novo estoque: ${novoEstoque}`);
        console.log(`Motivo: ${motivo}`);
        
        // Buscar o produto atual
        const { data: produto, error: fetchError } = await window.supabase
            .from('produtos')
            .select('estoque_atual, nome')
            .eq('id', produtoId)
            .single();
            
        if (fetchError) {
            console.error('Erro ao buscar produto:', fetchError);
            throw fetchError;
        }
        
        const estoqueAntes = produto.estoque_atual;
        console.log(`Estoque antes da correção: ${estoqueAntes} (${produto.nome})`);
        
        // Atualizar o estoque
        const { error: updateError } = await window.supabase
            .from('produtos')
            .update({ 
                estoque_atual: parseFloat(novoEstoque)
            })
            .eq('id', produtoId);
            
        if (updateError) {
            console.error('Erro ao atualizar estoque:', updateError);
            throw updateError;
        }
        
        // Registrar movimentação de correção
        const movimentacao = {
            produto_id: produtoId,
            tipo: 'entrada',
            quantidade: 0,
            operador: 'Sistema',
            observacao: `CORREÇÃO DE ESTOQUE: ${motivo}. Estoque anterior: ${estoqueAntes}, Novo estoque: ${novoEstoque}`
        };
        
        const { error: insertError } = await window.supabase
            .from('movimentacoes')
            .insert([movimentacao]);
            
        if (insertError) {
            console.error('Erro ao registrar movimentação de correção:', insertError);
            throw insertError;
        }
        
        console.log(`Estoque corrigido de ${estoqueAntes} para ${novoEstoque}`);
        showNotification(`Estoque corrigido! De ${estoqueAntes} para ${novoEstoque}`, 'success');
        
        // Atualizar interface
        await loadDependencies();
        await loadMovimentacoes();
        
        console.log('=== CORREÇÃO CONCLUÍDA ===');
        
    } catch (error) {
        console.error('Erro ao corrigir estoque:', error);
        showNotification('Erro ao corrigir estoque: ' + error.message, 'error');
    }
}

// Expor funções para uso global
window.deleteMovimentacao = deleteMovimentacao;
window.corrigirEstoque = corrigirEstoque;

// Função para verificar consistência do estoque
async function verificarConsistenciaEstoque() {
    try {
        console.log('=== VERIFICANDO CONSISTÊNCIA DO ESTOQUE ===');
        
        // Buscar todos os produtos
        const { data: produtos, error } = await window.supabase
            .from('produtos')
            .select('id, nome, estoque_atual');
            
        if (error) throw error;
        
        console.log(`Verificando ${produtos.length} produtos...`);
        
        let problemas = [];
        
        for (const produto of produtos) {
            console.log(`Verificando ${produto.nome}...`);
            
            // Buscar movimentações deste produto
            const { data: movimentacoes, error: movError } = await window.supabase
                .from('movimentacoes')
                .select('tipo, quantidade')
                .eq('produto_id', produto.id);
                
            if (movError) throw movError;
            
            // Calcular estoque com base nas movimentações
            let estoqueCalculado = 0;
            
            if (movimentacoes && movimentacoes.length > 0) {
                movimentacoes.forEach(mov => {
                    if (mov.tipo === 'entrada') {
                        estoqueCalculado += parseFloat(mov.quantidade);
                    } else {
                        estoqueCalculado -= parseFloat(mov.quantidade);
                    }
                });
            }
            
            const estoqueAtual = parseFloat(produto.estoque_atual);
            
            if (Math.abs(estoqueAtual - estoqueCalculado) > 0.01) {
                console.warn(`INCONSISTÊNCIA ENCONTRADA: ${produto.nome}`);
                console.warn(`  Estoque no banco: ${estoqueAtual}`);
                console.warn(`  Estoque calculado: ${estoqueCalculado}`);
                console.warn(`  Diferença: ${estoqueAtual - estoqueCalculado}`);
                
                problemas.push({
                    produto: produto.nome,
                    produtoId: produto.id,
                    estoqueBanco: estoqueAtual,
                    estoqueCalculado: estoqueCalculado,
                    diferenca: estoqueAtual - estoqueCalculado
                });
            } else {
                console.log(`  ✓ ${produto.nome}: OK (${estoqueAtual})`);
            }
        }
        
        if (problemas.length > 0) {
            console.error(`Encontrados ${problemas.length} problemas de consistência!`);
            console.table(problemas);
            
            // Criar relatório HTML
            let relatorio = `<h3>Problemas de Consistência Encontrados:</h3><ul>`;
            problemas.forEach(prob => {
                relatorio += `<li><strong>${prob.produto}</strong>: Banco=${prob.estoqueBanco}, Calculado=${prob.estoqueCalculado}, Diferença=${prob.diferenca}</li>`;
            });
            relatorio += `</ul>`;
            
            showNotification(`Encontrados ${problemas.length} problemas de consistência. Verifique o console.`, 'warning');
        } else {
            console.log('✓ Todos os estoques estão consistentes!');
            showNotification('Todos os estoques estão consistentes!', 'success');
        }
        
        console.log('=== VERIFICAÇÃO CONCLUÍDA ===');
        
        return problemas;
        
    } catch (error) {
        console.error('Erro ao verificar consistência:', error);
        showNotification('Erro ao verificar consistência do estoque', 'error');
    }
}

// Expor função de verificação
window.verificarConsistenciaEstoque = verificarConsistenciaEstoque;

// Verificação automática ao carregar a página (opcional)
// document.addEventListener('DOMContentLoaded', () => {
//     setTimeout(() => {
//         verificarConsistenciaEstoque();
//     }, 3000);
// });