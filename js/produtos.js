// ============================================
// PRODUTOS.JS - VERSÃO COMPLETA COM TODAS AS FUNÇÕES
// ============================================

class ProdutosManager {
    constructor() {
        this.currentTab = 'lista';
        this.editingId = null;
        this.categorias = [];
        this.fornecedores = [];
        this.depositos = [];
        this.produtos = [];
        this.selectedProducts = new Set();
        this.currentPage = 1;
        this.itemsPerPage = 50;
        this.totalPages = 1;
        this.searchTimeout = null;
        this.filters = {
            busca: '',
            categoria: '',
            fornecedor: '',
            deposito: '',
            status: ''
        };

        // Cache de elementos DOM
        this.domElements = {};
    }

    // ========== INICIALIZAÇÃO ==========
    async init() {
        console.log('🚀 Inicializando módulo de produtos...');
        
        try {
            // Aguarda o Supabase
            await this.waitForSupabase();
            
            if (!window.supabase) {
                showNotification('Erro: Banco de dados não inicializado', 'error');
                throw new Error('Supabase não disponível');
            }
            
            // Carrega dependências iniciais
            await this.loadDependencies();
            
            // Configura a interface
            this.setupTabs();
            this.setupEventListeners();
            this.setupFilters(); // Esta função estava faltando!
            
            // Carrega dados iniciais
            await this.loadProdutos();
            
            console.log('✅ Módulo de produtos inicializado com sucesso');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            showNotification('Erro ao inicializar módulo de produtos', 'error');
        }
    }

    // ========== UTILITÁRIOS DE DOM ==========
    getElement(id) {
        if (!this.domElements[id]) {
            this.domElements[id] = document.getElementById(id);
        }
        return this.domElements[id];
    }

    // ========== SUPABASE ==========
    async waitForSupabase(maxAttempts = 50) {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            
            const check = () => {
                attempts++;
                
                if (window.supabase) {
                    console.log('✅ Supabase carregado');
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Timeout: Supabase não carregado'));
                } else {
                    setTimeout(check, 100);
                }
            };
            
            check();
        });
    }

    // ========== CARREGAMENTO DE DADOS ==========
    async loadDependencies() {
        try {
            console.log('📥 Carregando dependências...');
            
            // Carrega categorias, fornecedores e depósitos
            const [categoriasRes, fornecedoresRes, depositosRes] = await Promise.all([
                window.supabase.from('categorias').select('*').order('nome'),
                window.supabase.from('fornecedores').select('*').order('nome'),
                window.supabase.from('depositos').select('*').order('nome')
            ]);
            
            // Armazena os dados
            this.categorias = categoriasRes.data || [];
            this.fornecedores = fornecedoresRes.data || [];
            this.depositos = depositosRes.data || [];
            
            // Atualiza a interface
            this.populateSelects();
            this.populateFilterSelects();
            this.renderCategoriasList();
            
            console.log(`✅ Dependências carregadas: 
                ${this.categorias.length} categorias, 
                ${this.fornecedores.length} fornecedores, 
                ${this.depositos.length} depósitos`);
        } catch (error) {
            console.error('❌ Erro ao carregar dependências:', error);
            showNotification('Erro ao carregar dados auxiliares', 'warning');
        }
    }

    async loadProdutos() {
        try {
            console.log('📦 Carregando produtos...');
            
            // Monta a query base
            let query = window.supabase
                .from('produtos')
                .select(`
                    *,
                    categorias(nome, cor),
                    fornecedores(nome),
                    depositos(nome)
                `, { count: 'exact' })
                .order('nome');

            // Aplica filtros
            if (this.filters.busca) {
                query = query.or(
                    `nome.ilike.%${this.filters.busca}%,` +
                    `codigo.ilike.%${this.filters.busca}%,` +
                    `descricao.ilike.%${this.filters.busca}%,` +
                    `codigo_barras.ilike.%${this.filters.busca}%`
                );
            }
            
            if (this.filters.categoria) {
                query = query.eq('categoria_id', this.filters.categoria);
            }
            
            if (this.filters.fornecedor) {
                query = query.eq('fornecedor_id', this.filters.fornecedor);
            }
            
            if (this.filters.deposito) {
                query = query.eq('deposito_id', this.filters.deposito);
            }
            
            if (this.filters.status) {
                switch(this.filters.status) {
                    case 'ativo':
                        query = query.eq('ativo', true);
                        break;
                    case 'inativo':
                        query = query.eq('ativo', false);
                        break;
                    case 'baixo':
                        query = query.lte('estoque_atual', window.supabase.raw('estoque_minimo'));
                        break;
                    case 'esgotado':
                        query = query.eq('estoque_atual', 0);
                        break;
                }
            }

            // Paginação
            const from = (this.currentPage - 1) * this.itemsPerPage;
            const to = from + this.itemsPerPage - 1;
            query = query.range(from, to);

            // Executa a query
            const { data: produtos, error, count } = await query;

            if (error) throw error;

            // Atualiza os dados
            this.produtos = produtos || [];
            this.totalPages = Math.ceil((count || 0) / this.itemsPerPage);
            
            // Atualiza a interface
            this.renderProdutosTable();
            this.renderProdutosCards();
            this.updatePagination();
            this.updateTotalRegistros();
            
            console.log(`✅ ${this.produtos.length} produtos carregados (Total: ${count})`);
        } catch (error) {
            console.error('❌ Erro ao carregar produtos:', error);
            showNotification('Erro ao carregar produtos', 'error');
        }
    }

    // ========== CONFIGURAÇÃO DE FILTROS ==========
    setupFilters() {
        const searchInput = this.getElement('filtroBusca');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.filters.busca = e.target.value;
                    this.applyFilters();
                }, 500);
            });
        }

        // Filtros de select
        ['filtroCategoria', 'filtroFornecedor', 'filtroDeposito', 'filtroStatus'].forEach(id => {
            const element = this.getElement(id);
            if (element) {
                element.addEventListener('change', () => {
                    const filterKey = id.replace('filtro', '').toLowerCase();
                    this.filters[filterKey] = element.value;
                    this.applyFilters();
                });
            }
        });
    }

    applyFilters() {
        this.currentPage = 1;
        this.selectedProducts.clear();
        this.updateSelectedCount();
        this.loadProdutos();
    }

    clearFilters() {
        this.filters = {
            busca: '',
            categoria: '',
            fornecedor: '',
            deposito: '',
            status: ''
        };
        
        // Limpa campos de filtro
        const buscaInput = this.getElement('filtroBusca');
        const categoriaSelect = this.getElement('filtroCategoria');
        const fornecedorSelect = this.getElement('filtroFornecedor');
        const depositoSelect = this.getElement('filtroDeposito');
        const statusSelect = this.getElement('filtroStatus');
        
        if (buscaInput) buscaInput.value = '';
        if (categoriaSelect) categoriaSelect.value = '';
        if (fornecedorSelect) fornecedorSelect.value = '';
        if (depositoSelect) depositoSelect.value = '';
        if (statusSelect) statusSelect.value = '';
        
        this.applyFilters();
    }

    // ========== RENDERIZAÇÃO ==========
    populateSelects() {
        const populate = (elementId, data, placeholder) => {
            const element = this.getElement(elementId);
            if (element && data.length > 0) {
                element.innerHTML = `
                    <option value="">${placeholder}</option>
                    ${data.map(item => `<option value="${item.id}">${item.nome}</option>`).join('')}
                `;
            }
        };

        populate('categoria_id', this.categorias, 'Selecione uma categoria');
        populate('fornecedor_id', this.fornecedores, 'Selecione um fornecedor');
        populate('deposito_id', this.depositos, 'Selecione um depósito');
    }

    populateFilterSelects() {
        const populate = (elementId, data, placeholder) => {
            const element = this.getElement(elementId);
            if (element) {
                const options = data.map(item => `<option value="${item.id}">${item.nome}</option>`).join('');
                element.innerHTML = `<option value="">${placeholder}</option>${options}`;
            }
        };

        populate('filtroCategoria', this.categorias, 'Todas as categorias');
        populate('filtroFornecedor', this.fornecedores, 'Todos os fornecedores');
        populate('filtroDeposito', this.depositos, 'Todos os depósitos');
    }

    renderProdutosTable() {
        const tbody = this.getElement('produtosTable');
        if (!tbody) return;

        if (this.produtos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="11" class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p>Nenhum produto encontrado</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.produtos.map(produto => this.getProdutoRowHTML(produto)).join('');
        
        // Configura os checkboxes
        this.setupRowCheckboxes();
    }

    getProdutoRowHTML(produto) {
        const categoria = produto.categorias?.nome || '-';
        const fornecedor = produto.fornecedores?.nome || '-';
        const deposito = produto.depositos?.nome || '-';
        const categoriaCor = produto.categorias?.cor || '#6b7280';
        
        const statusClass = this.getStockStatusClass(produto.estoque_atual, produto.estoque_minimo);
        const statusText = this.getStockStatusText(produto.estoque_atual, produto.estoque_minimo);
        const activeClass = produto.ativo ? 'badge-success' : 'badge-danger';
        const activeText = produto.ativo ? 'Ativo' : 'Inativo';

        return `
            <tr data-id="${produto.id}" class="${!produto.ativo ? 'inactive' : ''}">
                <td>
                    <input type="checkbox" class="row-checkbox" value="${produto.id}">
                </td>
                <td>${produto.codigo || '-'}</td>
                <td>
                    <div class="product-info">
                        <strong class="product-name">${this.escapeHtml(produto.nome)}</strong>
                        ${produto.codigo_barras ? 
                            `<div class="product-code">
                                <i class="fas fa-barcode"></i> ${produto.codigo_barras}
                            </div>` : ''
                        }
                        ${produto.descricao ? 
                            `<div class="product-desc">${this.escapeHtml(produto.descricao)}</div>` : ''
                        }
                    </div>
                </td>
                <td>
                    ${categoria !== '-' ? 
                        `<span class="categoria-badge" style="background-color: ${categoriaCor}">
                            ${categoria}
                        </span>` : 
                        '-'
                    }
                </td>
                <td>${produto.unidade_medida}</td>
                <td class="text-center">
                    <span class="stock-value ${statusClass}">${produto.estoque_atual || 0}</span>
                    <small class="unit-label">${produto.unidade_medida}</small>
                </td>
                <td class="text-center">${produto.estoque_minimo || 0}</td>
                <td class="text-right">${produto.preco_custo ? formatCurrency(produto.preco_custo) : '-'}</td>
                <td class="text-right">${produto.preco_venda ? formatCurrency(produto.preco_venda) : '-'}</td>
                <td>
                    <div class="status-badges">
                        <span class="badge ${activeClass}">${activeText}</span>
                        <span class="badge ${statusClass}">${statusText}</span>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button onclick="produtosManager.editProduto('${produto.id}')" 
                                class="btn btn-sm btn-action" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="produtosManager.duplicateProduct('${produto.id}')" 
                                class="btn btn-sm btn-action btn-info" title="Duplicar">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="produtosManager.confirmDelete('${produto.id}', '${this.escapeHtml(produto.nome)}')" 
                                class="btn btn-sm btn-action btn-danger" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button onclick="produtosManager.showMovimentacoes('${produto.id}')" 
                                class="btn btn-sm btn-action btn-secondary" title="Histórico">
                            <i class="fas fa-history"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // ========== CONFIGURAÇÃO DA INTERFACE ==========
    setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this.switchTab(tabId);
            });
        });
    }

    switchTab(tabId) {
        this.currentTab = tabId;
        
        // Atualiza tabs ativas
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        const activeTab = document.querySelector(`.tab[data-tab="${tabId}"]`);
        const activeContent = document.getElementById(`tab-${tabId}`);
        
        if (activeTab) activeTab.classList.add('active');
        if (activeContent) activeContent.classList.add('active');
        
        // Carrega dados específicos da tab
        if (tabId === 'cards') {
            this.renderProdutosCards();
        } else if (tabId === 'categorias') {
            this.loadProdutosPorCategoria();
        }
    }

    setupEventListeners() {
        // Botão novo produto
        this.setupButton('btnNovoProduto', () => this.openProdutoModal());
        
        // Botões de importar/exportar
        this.setupButton('btnImportar', () => this.importProdutos());
        this.setupButton('btnExportar', () => this.exportProdutos());
        
        // Botões de filtro
        this.setupButton('btnAplicarFiltros', () => this.applyFilters());
        this.setupButton('btnLimparFiltros', () => this.clearFilters());
        
        // Botões de paginação
        this.setupButton('btnAnterior', () => this.previousPage());
        this.setupButton('btnProximo', () => this.nextPage());
        
        // Botões de seleção
        this.setupButton('btnSelecionarTodos', () => this.toggleSelectAll());
        this.setupButton('btnAcoesEmMassa', () => this.openAcoesMassaModal());
        
        // Botão nova categoria
        this.setupButton('btnNovaCategoria', () => this.openCategoriaModal());
        
        // Botão salvar produto
        this.setupButton('btnSalvarProduto', (e) => {
            e.preventDefault();
            this.saveProduto();
        });
        
        // Botão salvar categoria
        this.setupButton('btnSalvarCategoria', (e) => {
            e.preventDefault();
            this.saveCategoria();
        });
        
        // Cálculo automático de margem de lucro
        this.setupPriceCalculations();
        
        // Scanner de código de barras
        this.setupBarcodeScanner();
    }

    setupButton(id, handler) {
        const button = this.getElement(id);
        if (button) {
            button.addEventListener('click', handler);
        }
    }

    setupRowCheckboxes() {
        const checkboxes = document.querySelectorAll('.row-checkbox');
        const checkAll = this.getElement('checkAll');
        
        // Configura checkbox principal
        if (checkAll) {
            checkAll.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                checkboxes.forEach(cb => {
                    cb.checked = isChecked;
                    const productId = cb.value;
                    if (isChecked) {
                        this.selectedProducts.add(productId);
                    } else {
                        this.selectedProducts.delete(productId);
                    }
                });
                this.updateSelectedCount();
            });
        }
        
        // Configura checkboxes individuais
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const productId = e.target.value;
                if (e.target.checked) {
                    this.selectedProducts.add(productId);
                } else {
                    this.selectedProducts.delete(productId);
                }
                
                // Atualiza checkbox principal
                if (checkAll) {
                    const allChecked = checkboxes.length === this.selectedProducts.size;
                    checkAll.checked = allChecked;
                }
                
                this.updateSelectedCount();
            });
        });
    }

    setupPriceCalculations() {
        // Calcula margem de lucro automaticamente
        const precoCusto = this.getElement('preco_custo');
        const precoVenda = this.getElement('preco_venda');
        const margemLucro = this.getElement('margem_lucro');
        
        const calculateMargin = () => {
            if (precoCusto && precoVenda && margemLucro) {
                const custo = parseFloat(precoCusto.value) || 0;
                const venda = parseFloat(precoVenda.value) || 0;
                
                if (custo > 0 && venda > 0) {
                    const margem = ((venda - custo) / custo * 100).toFixed(2);
                    margemLucro.value = margem;
                } else {
                    margemLucro.value = '';
                }
            }
        };
        
        if (precoCusto) precoCusto.addEventListener('input', calculateMargin);
        if (precoVenda) precoVenda.addEventListener('input', calculateMargin);
    }

    setupBarcodeScanner() {
        // Função global para scanner de código de barras
        window.scanBarcode = (targetId) => {
            const target = this.getElement(targetId);
            if (target) {
                // Simulação de leitura - em produção, integrar com API real
                const simulatedBarcode = '789' + Math.random().toString().slice(2, 11);
                target.value = simulatedBarcode;
                showNotification('Código de barras simulado inserido', 'info');
            }
        };
    }

    // ========== OPERAÇÕES CRUD ==========
    async saveProduto() {
        const form = this.getElement('produtoForm');
        if (!form) return;
        
        // Validação básica
        const nome = this.getElement('nome').value.trim();
        const unidadeMedida = this.getElement('unidade_medida').value;
        
        if (!nome || !unidadeMedida) {
            showNotification('Nome e unidade de medida são obrigatórios', 'warning');
            return;
        }
        
        // Coleta os dados do formulário de acordo com seu schema
        const produto = {
            nome: nome,
            codigo: this.getElement('codigo').value.trim() || null,
            codigo_barras: this.getElement('codigo_barras').value.trim() || null,
            descricao: this.getElement('descricao').value.trim() || null,
            unidade_medida: unidadeMedida,
            categoria_id: this.getElement('categoria_id').value || null,
            fornecedor_id: this.getElement('fornecedor_id').value || null,
            deposito_id: this.getElement('deposito_id').value || null,
            estoque_minimo: parseFloat(this.getElement('estoque_minimo').value) || 0,
            preco_custo: parseFloat(this.getElement('preco_custo').value) || null,
            preco_venda: parseFloat(this.getElement('preco_venda').value) || null,
            // Seu schema tem peso_bruto e peso_liquido, mas o HTML tem apenas 'peso'
            // Vamos usar peso_bruto para o campo 'peso' do formulário
            peso_bruto: parseFloat(this.getElement('peso').value) || null,
            volume: parseFloat(this.getElement('volume').value) || null,
            // Seu schema tem 'observacoes' (com 's' no final), não 'observacao'
            observacoes: this.getElement('observacoes').value.trim() || null,
            ativo: this.getElement('ativo').checked
        };

        console.log('Dados a serem enviados:', produto);

        try {
            let error;
            if (this.editingId) {
                console.log('Atualizando produto:', this.editingId);
                const { error: updateError } = await window.supabase
                    .from('produtos')
                    .update(produto)
                    .eq('id', this.editingId);
                error = updateError;
            } else {
                // Para novo produto, adiciona estoque_atual = 0
                produto.estoque_atual = 0;
                console.log('Criando novo produto');
                const { error: insertError } = await window.supabase
                    .from('produtos')
                    .insert([produto]);
                error = insertError;
            }

            if (error) {
                console.error('Erro do Supabase:', error);
                throw error;
            }

            showNotification(`✅ Produto ${this.editingId ? 'atualizado' : 'cadastrado'} com sucesso!`, 'success');
            this.closeModal('produtoModal');
            this.editingId = null;
            
            // Recarrega a lista de produtos
            await this.loadProdutos();
            
            // Reseta o formulário
            this.clearProdutoForm();
        } catch (error) {
            console.error('❌ Erro completo ao salvar produto:', error);
            showNotification(`Erro ao salvar produto: ${error.message || 'Verifique os dados e tente novamente'}`, 'error');
        }
    }

    async editProduto(id) {
        try {
            const { data: produto, error } = await window.supabase
                .from('produtos')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            this.editingId = id;
            this.openProdutoModal(produto);
        } catch (error) {
            console.error('❌ Erro ao carregar produto:', error);
            showNotification('Erro ao carregar produto para edição', 'error');
        }
    }

    populateProdutoForm(produto) {
        // Mapeia os campos do banco para os campos do formulário
        const fieldMappings = {
            'nome': 'nome',
            'codigo': 'codigo',
            'codigo_barras': 'codigo_barras',
            'descricao': 'descricao',
            'unidade_medida': 'unidade_medida',
            'categoria_id': 'categoria_id',
            'fornecedor_id': 'fornecedor_id',
            'deposito_id': 'deposito_id',
            'estoque_minimo': 'estoque_minimo',
            'preco_custo': 'preco_custo',
            'preco_venda': 'preco_venda',
            'peso_bruto': 'peso', // Mapeia peso_bruto do banco para 'peso' do formulário
            'volume': 'volume',
            'observacoes': 'observacoes',
            'ativo': 'ativo'
        };

        Object.entries(fieldMappings).forEach(([dbField, formField]) => {
            const element = this.getElement(formField);
            if (element) {
                if (element.type === 'checkbox') {
                    element.checked = !!produto[dbField];
                } else {
                    element.value = produto[dbField] || '';
                }
            }
        });
        
        // ID oculto
        const produtoId = this.getElement('produtoId');
        if (produtoId) produtoId.value = produto.id;
        
        // Calcula margem de lucro
        this.setupPriceCalculations();
    }

    clearProdutoForm() {
        const form = this.getElement('produtoForm');
        if (form) {
            form.reset();
            
            // Reseta valores específicos
            const margemLucro = this.getElement('margem_lucro');
            if (margemLucro) margemLucro.value = '';
            
            const produtoId = this.getElement('produtoId');
            if (produtoId) produtoId.value = '';
        }
    }

    async duplicateProduct(id) {
        try {
            const { data: produto, error } = await window.supabase
                .from('produtos')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;

            // Remove campos que não devem ser duplicados
            const { id: _, created_at: __, ...produtoCopy } = produto;
            
            // Personaliza a cópia
            produtoCopy.nome = `${produto.nome} (Cópia)`;
            produtoCopy.codigo = produto.codigo ? `${produto.codigo}-COPY` : null;
            produtoCopy.codigo_barras = null;
            produtoCopy.estoque_atual = 0;

            const { error: insertError } = await window.supabase
                .from('produtos')
                .insert([produtoCopy]);

            if (insertError) throw insertError;

            showNotification('✅ Produto duplicado com sucesso!', 'success');
            await this.loadProdutos();
        } catch (error) {
            console.error('❌ Erro ao duplicar produto:', error);
            showNotification('Erro ao duplicar produto', 'error');
        }
    }

    confirmDelete(id, nome) {
        if (confirm(`Tem certeza que deseja excluir o produto "${nome}"?\nEsta ação não pode ser desfeita.`)) {
            this.deleteProduto(id);
        }
    }

    async deleteProduto(id) {
        try {
            const { error } = await window.supabase
                .from('produtos')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showNotification('✅ Produto excluído com sucesso!', 'success');
            await this.loadProdutos();
        } catch (error) {
            console.error('❌ Erro ao excluir produto:', error);
            showNotification('Erro ao excluir produto', 'error');
        }
    }

    // ========== MODAIS ==========
    openProdutoModal(produto = null) {
        const modal = this.getElement('produtoModal');
        const titulo = this.getElement('modalTitulo');
        
        if (produto) {
            titulo.textContent = 'Editar Produto';
            this.populateProdutoForm(produto);
        } else {
            titulo.textContent = 'Novo Produto';
            this.clearProdutoForm();
        }
        
        this.openModal('produtoModal');
    }

    openCategoriaModal(categoria = null) {
        const modal = this.getElement('categoriaModal');
        const titulo = this.getElement('categoriaModalTitulo');
        const categoriaId = this.getElement('categoriaId');
        
        if (categoria) {
            titulo.textContent = 'Editar Categoria';
            categoriaId.value = categoria.id;
            this.getElement('categoriaNome').value = categoria.nome || '';
            this.getElement('categoriaDescricao').value = categoria.descricao || '';
            this.getElement('categoriaCor').value = categoria.cor || '#3b82f6';
            this.getElement('categoriaCorHex').value = categoria.cor || '#3b82f6';
            this.getElement('categoriaAtiva').checked = categoria.ativa !== false;
            
            // Popula categoria pai (parent_id no seu schema)
            this.populateSelect('categoriaPai', 
                this.categorias.filter(c => c.id !== categoria.id), 
                'Nenhuma (Categoria Raiz)'
            );
            // Use parent_id do seu schema
            this.getElement('categoriaPai').value = categoria.parent_id || '';
        } else {
            titulo.textContent = 'Nova Categoria';
            categoriaId.value = '';
            this.getElement('categoriaForm').reset();
            
            // Popula categoria pai
            this.populateSelect('categoriaPai', this.categorias, 'Nenhuma (Categoria Raiz)');
        }
        
        this.openModal('categoriaModal');
    }

    populateSelect(elementId, data, placeholder) {
        const element = this.getElement(elementId);
        if (element) {
            element.innerHTML = `
                <option value="">${placeholder}</option>
                ${data.map(item => `<option value="${item.id}">${item.nome}</option>`).join('')}
            `;
        }
    }

    async saveCategoria() {
        const form = this.getElement('categoriaForm');
        if (!form) return;
        
        const nome = this.getElement('categoriaNome').value.trim();
        if (!nome) {
            showNotification('O nome da categoria é obrigatório', 'warning');
            return;
        }
        
        const categoria = {
            nome: nome,
            descricao: this.getElement('categoriaDescricao').value.trim() || null,
            cor: this.getElement('categoriaCor').value,
            // Use parent_id conforme seu schema
            parent_id: this.getElement('categoriaPai').value || null,
            ativa: this.getElement('categoriaAtiva').checked
        };
        
        const categoriaId = this.getElement('categoriaId').value;
        
        try {
            let error;
            if (categoriaId) {
                const { error: updateError } = await window.supabase
                    .from('categorias')
                    .update(categoria)
                    .eq('id', categoriaId);
                error = updateError;
            } else {
                const { error: insertError } = await window.supabase
                    .from('categorias')
                    .insert([categoria]);
                error = insertError;
            }

            if (error) throw error;

            showNotification(`✅ Categoria ${categoriaId ? 'atualizada' : 'criada'} com sucesso!`, 'success');
            this.closeModal('categoriaModal');
            
            // Recarrega dependências
            await this.loadDependencies();
            await this.loadProdutos();
        } catch (error) {
            console.error('❌ Erro ao salvar categoria:', error);
            showNotification(`Erro ao salvar categoria: ${error.message}`, 'error');
        }
    }

    openAcoesMassaModal() {
        if (this.selectedProducts.size === 0) {
            showNotification('Selecione pelo menos um produto', 'warning');
            return;
        }
        
        const quantidadeSelecionados = this.getElement('quantidadeSelecionados');
        if (quantidadeSelecionados) {
            quantidadeSelecionados.textContent = this.selectedProducts.size;
        }
        
        this.openModal('acoesMassaModal');
    }

    // ========== PAGINAÇÃO E SELEÇÃO ==========
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.loadProdutos();
        }
    }

    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.loadProdutos();
        }
    }

    updatePagination() {
        const paginaAtualElement = this.getElement('paginaAtual');
        const btnAnterior = this.getElement('btnAnterior');
        const btnProximo = this.getElement('btnProximo');
        
        if (paginaAtualElement) {
            paginaAtualElement.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
        }
        
        if (btnAnterior) {
            btnAnterior.disabled = this.currentPage <= 1;
        }
        
        if (btnProximo) {
            btnProximo.disabled = this.currentPage >= this.totalPages;
        }
    }

    updateTotalRegistros() {
        const totalRegistros = this.getElement('totalRegistros');
        if (totalRegistros) {
            totalRegistros.textContent = `${this.produtos.length} produtos encontrados`;
        }
    }

    toggleSelectAll() {
        const checkAll = this.getElement('checkAll');
        const checkboxes = document.querySelectorAll('.row-checkbox');
        
        const isChecked = !checkAll.checked;
        checkAll.checked = isChecked;
        
        checkboxes.forEach(cb => {
            cb.checked = isChecked;
            const productId = cb.value;
            if (isChecked) {
                this.selectedProducts.add(productId);
            } else {
                this.selectedProducts.delete(productId);
            }
        });
        
        this.updateSelectedCount();
    }

    updateSelectedCount() {
        const quantidadeSelecionados = this.getElement('quantidadeSelecionados');
        if (quantidadeSelecionados) {
            quantidadeSelecionados.textContent = this.selectedProducts.size;
        }
    }

    // ========== FUNCIONALIDADES ESPECÍFICAS ==========
    renderProdutosCards() {
        const container = this.getElement('produtosCards');
        if (!container) return;

        if (this.produtos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-box-open"></i>
                    <p>Nenhum produto encontrado</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.produtos.map(produto => this.getProdutoCardHTML(produto)).join('');
    }

    getProdutoCardHTML(produto) {
        const categoria = produto.categorias?.nome || 'Sem categoria';
        const categoriaCor = produto.categorias?.cor || '#6b7280';
        const statusClass = this.getStockStatusClass(produto.estoque_atual, produto.estoque_minimo);
        const statusText = this.getStockStatusText(produto.estoque_atual, produto.estoque_minimo);
        const activeClass = produto.ativo ? 'active' : 'inactive';

        return `
            <div class="product-card ${activeClass}" data-id="${produto.id}">
                <div class="card-header" style="border-left-color: ${categoriaCor};">
                    <div class="card-category" style="background-color: ${categoriaCor};">
                        ${categoria}
                    </div>
                    <div class="card-actions">
                        <button onclick="produtosManager.editProduto('${produto.id}')" class="btn btn-sm">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <h4 class="card-title">${this.escapeHtml(produto.nome)}</h4>
                    
                    ${produto.codigo ? 
                        `<div class="card-code">
                            <i class="fas fa-hashtag"></i> ${produto.codigo}
                        </div>` : ''
                    }
                    
                    <div class="card-stats">
                        <div class="stat">
                            <i class="fas fa-box"></i>
                            <span class="stat-value">${produto.estoque_atual || 0}</span>
                            <span class="stat-label">${produto.unidade_medida}</span>
                        </div>
                        <div class="stat">
                            <i class="fas fa-dollar-sign"></i>
                            <span class="stat-value">${produto.preco_venda ? formatCurrency(produto.preco_venda) : '-'}</span>
                        </div>
                    </div>
                    
                    <div class="card-status">
                        <span class="badge ${statusClass}">${statusText}</span>
                        <span class="badge ${produto.ativo ? 'badge-success' : 'badge-danger'}">
                            ${produto.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                    </div>
                </div>
                <div class="card-footer">
                    <button onclick="produtosManager.duplicateProduct('${produto.id}')" 
                            class="btn btn-sm btn-info">
                        <i class="fas fa-copy"></i> Duplicar
                    </button>
                    <button onclick="produtosManager.showMovimentacoes('${produto.id}')" 
                            class="btn btn-sm btn-secondary">
                        <i class="fas fa-history"></i>
                    </button>
                </div>
            </div>
        `;
    }

    renderCategoriasList() {
        const container = this.getElement('categoriasList');
        if (!container) return;

        // Filtra categorias principais (sem pai)
        const mainCategories = this.categorias.filter(cat => !cat.parent_id);
        
        if (mainCategories.length === 0) {
            container.innerHTML = `
                <div class="empty-categories">
                    <p>Nenhuma categoria cadastrada</p>
                    <button onclick="produtosManager.openCategoriaModal()" class="btn btn-sm btn-primary">
                        <i class="fas fa-plus"></i> Criar primeira categoria
                    </button>
                </div>
            `;
            return;
        }

        container.innerHTML = mainCategories.map(categoria => 
            this.getCategoriaItemHTML(categoria)
        ).join('');
    }

    getCategoriaItemHTML(categoria) {
        const subcategorias = this.categorias.filter(cat => cat.parent_id === categoria.id);
        const produtosCount = this.produtos.filter(p => p.categoria_id === categoria.id).length;
        
        return `
            <div class="categoria-item" data-id="${categoria.id}">
                <div class="categoria-header" onclick="produtosManager.loadProdutosPorCategoria('${categoria.id}')">
                    <i class="fas fa-folder"></i>
                    <span class="categoria-nome">${categoria.nome}</span>
                    <span class="categoria-count">${produtosCount}</span>
                </div>
                ${subcategorias.length > 0 ? `
                    <div class="subcategorias">
                        ${subcategorias.map(sub => this.getCategoriaItemHTML(sub)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    async loadProdutosPorCategoria(categoriaId = null) {
        const container = this.getElement('categoriaProdutos');
        if (!container) return;
        
        if (!categoriaId) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-tag"></i>
                    <p>Selecione uma categoria para ver os produtos</p>
                </div>
            `;
            return;
        }
        
        try {
            const { data: produtos, error } = await window.supabase
                .from('produtos')
                .select(`
                    *,
                    categorias(nome, cor),
                    fornecedores(nome),
                    depositos(nome)
                `)
                .eq('categoria_id', categoriaId)
                .order('nome');
            
            if (error) throw error;
            
            if (produtos.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-box-open"></i>
                        <p>Nenhum produto nesta categoria</p>
                    </div>
                `;
                return;
            }
            
            container.innerHTML = produtos.map(produto => `
                <div class="categoria-produto-item">
                    <div class="produto-info">
                        <strong>${produto.nome}</strong>
                        <div class="produto-details">
                            <span>Código: ${produto.codigo || 'N/A'}</span>
                            <span>Estoque: ${produto.estoque_atual} ${produto.unidade_medida}</span>
                            <span>Preço: ${produto.preco_venda ? formatCurrency(produto.preco_venda) : 'N/A'}</span>
                        </div>
                    </div>
                    <div class="produto-actions">
                        <button onclick="produtosManager.editProduto('${produto.id}')" class="btn btn-sm">
                            <i class="fas fa-edit"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('❌ Erro ao carregar produtos por categoria:', error);
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Erro ao carregar produtos</p>
                </div>
            `;
        }
    }

    showMovimentacoes(produtoId) {
        window.location.href = `movimentacoes.html?produto=${produtoId}`;
    }

    // ========== UTILITÁRIOS ==========
    getStockStatusClass(estoqueAtual, estoqueMinimo) {
        if (estoqueAtual <= 0) return 'badge-danger';
        if (estoqueAtual <= estoqueMinimo) return 'badge-warning';
        return 'badge-success';
    }

    getStockStatusText(estoqueAtual, estoqueMinimo) {
        if (estoqueAtual <= 0) return 'Esgotado';
        if (estoqueAtual <= estoqueMinimo) return 'Baixo';
        return 'Normal';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    openModal(modalId) {
        const modal = this.getElement(modalId);
        if (modal) {
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('show'), 10);
        }
    }

    closeModal(modalId) {
        const modal = this.getElement(modalId);
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    }

    // Funções placeholder para importação/exportação
    importProdutos() {
        showNotification('Funcionalidade de importação em desenvolvimento', 'info');
    }

    exportProdutos() {
        showNotification('Funcionalidade de exportação em desenvolvimento', 'info');
    }
}

// ========== INICIALIZAÇÃO GLOBAL ==========
let produtosManager;

document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 Página de produtos carregada');
    
    // Inicializa o gerenciador
    produtosManager = new ProdutosManager();
    
    // Inicia o módulo
    setTimeout(() => {
        produtosManager.init();
    }, 100);
    
    // Expõe globalmente para eventos onclick
    window.produtosManager = produtosManager;
    
    // Funções globais para modais
    window.closeModal = (modalId) => {
        produtosManager.closeModal(modalId);
    };
});