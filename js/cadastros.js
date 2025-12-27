document.addEventListener('DOMContentLoaded', () => {
    // Configurar abas
    setupTabs();
    
    // Carregar dados quando o Supabase estiver pronto
    document.addEventListener('supabaseReady', () => {
        loadFornecedores();
        loadCategorias();
        loadDepositos();
        setupForms();
    });
});

function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Remove active de todos
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Adiciona active ao selecionado
            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

function setupForms() {
    // Formulário de fornecedor
    document.getElementById('fornecedorForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!window.supabase) {
            showNotification('Supabase não inicializado', 'error');
            return;
        }
        
        const fornecedor = {
            nome: document.getElementById('fornecedorNome').value.trim(),
            cnpj: document.getElementById('fornecedorCNPJ').value.trim() || null,
            telefone: document.getElementById('fornecedorTelefone').value.trim() || null,
            email: document.getElementById('fornecedorEmail').value.trim() || null,
            endereco: document.getElementById('fornecedorEndereco').value.trim() || null,
            created_at: new Date().toISOString()
        };
        
        try {
            const { error } = await window.supabase
                .from('fornecedores')
                .insert([fornecedor]);
                
            if (error) throw error;
            
            showNotification('Fornecedor cadastrado com sucesso!', 'success');
            resetForm('fornecedorForm');
            loadFornecedores();
        } catch (error) {
            console.error('Erro ao cadastrar fornecedor:', error);
            showNotification('Erro ao cadastrar fornecedor: ' + error.message, 'error');
        }
    });
    
    // Formulário de categoria
    document.getElementById('categoriaForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const categoria = {
            nome: document.getElementById('categoriaNome').value.trim(),
            descricao: document.getElementById('categoriaDescricao').value.trim() || null
        };
        
        try {
            const { error } = await window.supabase
                .from('categorias')
                .insert([categoria]);
                
            if (error) throw error;
            
            showNotification('Categoria cadastrada com sucesso!', 'success');
            resetForm('categoriaForm');
            loadCategorias();
        } catch (error) {
            console.error('Erro ao cadastrar categoria:', error);
            showNotification('Erro ao cadastrar categoria: ' + error.message, 'error');
        }
    });
    
    // Formulário de depósito
    document.getElementById('depositoForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const deposito = {
            nome: document.getElementById('depositoNome').value.trim(),
            localizacao: document.getElementById('depositoLocalizacao').value.trim() || null
        };
        
        try {
            const { error } = await window.supabase
                .from('depositos')
                .insert([deposito]);
                
            if (error) throw error;
            
            showNotification('Depósito cadastrado com sucesso!', 'success');
            resetForm('depositoForm');
            loadDepositos();
        } catch (error) {
            console.error('Erro ao cadastrar depósito:', error);
            showNotification('Erro ao cadastrar depósito: ' + error.message, 'error');
        }
    });
}

async function loadFornecedores() {
    try {
        const { data: fornecedores, error } = await window.supabase
            .from('fornecedores')
            .select('*')
            .order('nome');
            
        if (error) throw error;
        
        renderFornecedoresTable(fornecedores);
    } catch (error) {
        console.error('Erro ao carregar fornecedores:', error);
        document.getElementById('fornecedoresTable').innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--danger-color);">
                    Erro ao carregar fornecedores
                </td>
            </tr>
        `;
    }
}

function renderFornecedoresTable(fornecedores) {
    const tbody = document.getElementById('fornecedoresTable');
    
    if (fornecedores.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem;">
                    Nenhum fornecedor cadastrado
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = fornecedores.map(fornecedor => `
        <tr>
            <td>${fornecedor.nome}</td>
            <td>${fornecedor.cnpj || '-'}</td>
            <td>${fornecedor.telefone || '-'}</td>
            <td>${fornecedor.email || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editFornecedor('${fornecedor.id}')" class="btn btn-sm" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteFornecedor('${fornecedor.id}', '${fornecedor.nome}')" 
                            class="btn btn-sm btn-danger" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadCategorias() {
    try {
        const { data: categorias, error } = await window.supabase
            .from('categorias')
            .select('*')
            .order('nome');
            
        if (error) throw error;
        
        renderCategoriasTable(categorias);
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        document.getElementById('categoriasTable').innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: var(--danger-color);">
                    Erro ao carregar categorias
                </td>
            </tr>
        `;
    }
}

function renderCategoriasTable(categorias) {
    const tbody = document.getElementById('categoriasTable');
    
    if (categorias.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 2rem;">
                    Nenhuma categoria cadastrada
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = categorias.map(categoria => `
        <tr>
            <td>${categoria.nome}</td>
            <td>${categoria.descricao || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editCategoria('${categoria.id}')" class="btn btn-sm" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteCategoria('${categoria.id}', '${categoria.nome}')" 
                            class="btn btn-sm btn-danger" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

async function loadDepositos() {
    try {
        const { data: depositos, error } = await window.supabase
            .from('depositos')
            .select('*')
            .order('nome');
            
        if (error) throw error;
        
        renderDepositosTable(depositos);
    } catch (error) {
        console.error('Erro ao carregar depósitos:', error);
        document.getElementById('depositosTable').innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; color: var(--danger-color);">
                    Erro ao carregar depósitos
                </td>
            </tr>
        `;
    }
}

function renderDepositosTable(depositos) {
    const tbody = document.getElementById('depositosTable');
    
    if (depositos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" style="text-align: center; padding: 2rem;">
                    Nenhum depósito cadastrado
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = depositos.map(deposito => `
        <tr>
            <td>${deposito.nome}</td>
            <td>${deposito.localizacao || '-'}</td>
            <td>
                <div class="action-buttons">
                    <button onclick="editDeposito('${deposito.id}')" class="btn btn-sm" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteDeposito('${deposito.id}', '${deposito.nome}')" 
                            class="btn btn-sm btn-danger" title="Excluir">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Funções de edição e exclusão (serão implementadas de forma semelhante aos produtos)
async function editFornecedor(id) {
    // Implementar edição
    console.log('Editar fornecedor:', id);
}

async function deleteFornecedor(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o fornecedor "${nome}"?`)) return;
    
    try {
        const { error } = await window.supabase
            .from('fornecedores')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        showNotification('Fornecedor excluído com sucesso!', 'success');
        loadFornecedores();
    } catch (error) {
        console.error('Erro ao excluir fornecedor:', error);
        showNotification('Erro ao excluir fornecedor: ' + error.message, 'error');
    }
}

async function editCategoria(id) {
    // Implementar edição
    console.log('Editar categoria:', id);
}

async function deleteCategoria(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${nome}"?`)) return;
    
    try {
        const { error } = await window.supabase
            .from('categorias')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        showNotification('Categoria excluída com sucesso!', 'success');
        loadCategorias();
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showNotification('Erro ao excluir categoria: ' + error.message, 'error');
    }
}

async function editDeposito(id) {
    // Implementar edição
    console.log('Editar depósito:', id);
}

async function deleteDeposito(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o depósito "${nome}"?`)) return;
    
    try {
        const { error } = await window.supabase
            .from('depositos')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        
        showNotification('Depósito excluído com sucesso!', 'success');
        loadDepositos();
    } catch (error) {
        console.error('Erro ao excluir depósito:', error);
        showNotification('Erro ao excluir depósito: ' + error.message, 'error');
    }
}

// Função auxiliar para resetar formulários
function resetForm(formId) {
    document.getElementById(formId).reset();
}