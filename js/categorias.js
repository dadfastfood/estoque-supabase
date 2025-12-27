// ============================================
// CATEGORIAS.JS - CÓDIGO COMPLETO
// ============================================

let editingId = null;
let categorias = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de Categorias carregada');
    
    // Aguarda o Supabase ficar pronto
    await waitForSupabase();
    
    if (!window.isSupabaseReady()) {
        showNotification('Erro: Sistema não inicializado', 'error');
        return;
    }
    
    await loadCategorias();
    setupEventListeners();
    setupSearch();
    setupColorPicker();

    //Função para ativar salvamento por teclas
    document.addEventListener('keydown', function(event) {
        // Verifica se CTRL (ou Command no Mac) e 'S' foram pressionados
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            
            // 1. Impede o comportamento padrão do navegador (Salvar página)
            event.preventDefault();

            // 2. Seleciona o formulário
            const form = document.getElementById('categoriaForm');

            // 3. Dispara o envio do formulário
            if (form) {
                // Feedback visual rápido no console (opcional)
                console.log('Atalho Ctrl+S acionado: Tentando salvar...');
                
                // O requestSubmit() é melhor que submit() pois ele:
                // - Aciona as validações HTML (required, type="email")
                // - Dispara o evento 'submit' que vamos configurar para o Supabase
                form.requestSubmit();
                
                // Opcional: Efeito visual no botão para mostrar que foi clicado
                const btnSalvar = form.querySelector('button[type="submit"]');
                if(btnSalvar) {
                    btnSalvar.style.transform = "scale(0.95)";
                    setTimeout(() => btnSalvar.style.transform = "scale(1)", 100);
                }
            }
        }
    });
});

async function waitForSupabase() {
    return new Promise((resolve) => {
        const checkSupabase = () => {
            if (window.supabase) {
                resolve();
            } else {
                setTimeout(checkSupabase, 100);
            }
        };
        checkSupabase();
    });
}

function setupColorPicker() {
    const corInput = document.getElementById('cor');
    const corTextInput = document.getElementById('corText');
    
    if (corInput && corTextInput) {
        corInput.addEventListener('input', (e) => {
            corTextInput.value = e.target.value;
        });
        
        corTextInput.addEventListener('input', (e) => {
            if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
                corInput.value = e.target.value;
            }
        });
    }
}

function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Formulário principal - VERIFICAÇÃO DE SEGURANÇA
    const categoriaForm = document.getElementById('categoriaForm');
    if (categoriaForm) {
        console.log('Formulário encontrado, adicionando event listener');
        categoriaForm.addEventListener('submit', handleSubmit);
    } else {
        console.warn('Formulário categoriaForm não encontrado! Verifique o HTML.');
    }
    
    // Botão limpar - VERIFICAÇÃO DE SEGURANÇA
    const btnLimpar = document.getElementById('btnLimpar');
    if (btnLimpar) {
        console.log('Botão limpar encontrado');
        btnLimpar.addEventListener('click', () => {
            if (typeof resetForm === 'function') {
                resetForm('categoriaForm');
            } else {
                console.error('Função resetForm não disponível!');
                const form = document.getElementById('categoriaForm');
                if (form) form.reset();
            }
        });
    } else {
        console.warn('Botão btnLimpar não encontrado!');
    }
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadCategorias(e.target.value);
            }, 300);
        });
    }
}

async function loadCategorias(searchTerm = '') {
    try {
        console.log('Carregando categorias...');
        let query = window.supabase
            .from('categorias')
            .select('*')
            .order('ordem', { ascending: true });

        if (searchTerm) {
            query = query.or(`nome.ilike.%${searchTerm}%,descricao.ilike.%${searchTerm}%`);
        }

        const { data: categoriasData, error } = await query;

        if (error) throw error;

        // Armazenar categorias globalmente para uso posterior
        categorias = categoriasData || [];
        renderCategoriasTable(categorias);
        populateParentSelect();
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
        showNotification('Erro ao carregar categorias', 'error');
    }
}

function populateParentSelect() {
    const parentSelect = document.getElementById('parent_id');
    if (parentSelect && categorias.length > 0) {
        parentSelect.innerHTML = '<option value="">Nenhuma (categoria raiz)</option>' +
            categorias.map(cat => 
                `<option value="${cat.id}">${cat.nome}</option>`
            ).join('');
    }
}

function renderCategoriasTable(categoriasData) {
    const tbody = document.getElementById('categoriasTable');
    
    if (!tbody) {
        console.error('Tabela categoriasTable não encontrada no HTML');
        return;
    }
    
    if (!categoriasData || categoriasData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    <i class="fas fa-tags"></i>
                    <p>Nenhuma categoria encontrada</p>
                </td>
            </tr>
        `;
        return;
    }

    // Organizar categorias por hierarquia
    const categoriasHierarquicas = organizeCategoriesByHierarchy(categoriasData);

    tbody.innerHTML = categoriasHierarquicas.map(categoria => {
        const nivel = getCategoryLevel(categoria.id, categoriasData);
        const statusClass = categoria.ativo ? 'badge-success' : 'badge-danger';
        const statusText = categoria.ativo ? 'Ativa' : 'Inativa';
        const parentName = categoria.parent_id ? 
            categoriasData.find(c => c.id === categoria.parent_id)?.nome || '' : '';
        
        return `
            <tr>
                <td>
                    ${'<span class="hierarchy-indent"></span>'.repeat(nivel)}
                    <i class="fas fa-folder" style="color: ${categoria.cor || '#3b82f6'}"></i>
                    <strong style="margin-left: 8px;">${categoria.nome}</strong>
                    ${categoria.descricao ? `<br><small class="text-muted">${categoria.descricao}</small>` : ''}
                </td>
                <td>
                    <div class="color-display" style="background-color: ${categoria.cor || '#3b82f6'};"></div>
                    <small>${categoria.cor || '#3b82f6'}</small>
                </td>
                <td>${parentName || '-'}</td>
                <td>${categoria.ordem || 0}</td>
                <td>
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
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
        `;
    }).join('');
}

function organizeCategoriesByHierarchy(categorias) {
    // Encontrar categorias raiz (sem parent_id)
    const roots = categorias.filter(cat => !cat.parent_id);
    
    // Função recursiva para adicionar filhos
    function addChildren(parent, allCategorias, nivel = 0) {
        const children = allCategorias.filter(cat => cat.parent_id === parent.id);
        parent.nivel = nivel;
        const result = [parent];
        
        children.forEach(child => {
            result.push(...addChildren(child, allCategorias, nivel + 1));
        });
        
        return result;
    }
    
    // Construir hierarquia
    let result = [];
    roots.forEach(root => {
        result.push(...addChildren(root, categorias));
    });
    
    return result;
}

function getCategoryLevel(categoryId, categorias) {
    let nivel = 0;
    let current = categorias.find(c => c.id === categoryId);
    
    while (current && current.parent_id) {
        nivel++;
        current = categorias.find(c => c.id === current.parent_id);
    }
    
    return nivel;
}

async function handleSubmit(event) {
    event.preventDefault();
    
    // Verifica se validateForm existe, senão usa validação básica
    let formIsValid;
    if (typeof validateForm === 'function') {
        formIsValid = validateForm('categoriaForm');
    } else {
        // Validação básica como fallback
        formIsValid = validateFormBasic('categoriaForm');
    }
    
    if (!formIsValid) {
        showNotification('Preencha todos os campos obrigatórios corretamente', 'warning');
        return;
    }
    
    // Função segura para obter valor do campo
    const getValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    };

    const getChecked = (id) => {
        const element = document.getElementById(id);
        return element ? element.checked : true;
    };

    const categoria = {
        nome: getValue('nome'),
        descricao: getValue('descricao'),
        cor: getValue('corText') || getValue('cor'),
        parent_id: getValue('parent_id') || null,
        ordem: parseInt(getValue('ordem')) || 0,
        ativo: getChecked('ativo')
    };

    // Validação manual dos campos obrigatórios
    if (!categoria.nome) {
        showNotification('O campo "Nome da Categoria" é obrigatório', 'warning');
        return;
    }

    try {
        const { error } = await window.supabase
            .from('categorias')
            .insert([categoria]);

        if (error) throw error;

        showNotification('Categoria cadastrada com sucesso!', 'success');
        
        // Resetar formulário de forma segura
        if (typeof resetForm === 'function') {
            resetForm('categoriaForm');
        } else {
            // Fallback se resetForm não estiver disponível
            const form = document.getElementById('categoriaForm');
            if (form) form.reset();
        }
        
        await loadCategorias();
    } catch (error) {
        console.error('Erro ao cadastrar categoria:', error);
        showNotification('Erro ao cadastrar categoria: ' + error.message, 'error');
    }
}

// Função de validação básica (fallback)
function validateFormBasic(formId) {
    const form = document.getElementById(formId);
    if (!form) return false;
    
    const requiredInputs = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredInputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
        }
    });
    
    return isValid;
}

async function editCategoria(id) {
    try {
        const { data: categoria, error } = await window.supabase
            .from('categorias')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        editingId = id;
        openEditModal(categoria);
    } catch (error) {
        console.error('Erro ao carregar categoria:', error);
        showNotification('Erro ao carregar categoria', 'error');
    }
}

function openEditModal(categoria) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Editar Categoria</h3>
                <button onclick="this.closest('.modal').remove()" class="btn btn-sm">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="editCategoriaForm">
                    <input type="hidden" id="editId" value="${categoria.id}">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="editNome">Nome *</label>
                            <input type="text" id="editNome" class="form-control" value="${categoria.nome || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editDescricao">Descrição</label>
                            <textarea id="editDescricao" class="form-control" rows="3">${categoria.descricao || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="editCor">Cor</label>
                            <div class="color-picker">
                                <input type="color" id="editCor" class="form-control" value="${categoria.cor || '#3b82f6'}">
                                <input type="text" id="editCorText" class="form-control" value="${categoria.cor || '#3b82f6'}" placeholder="#3b82f6">
                            </div>
                        </div>
                        <div class="form-group">
                            <label for="editParentId">Categoria Pai</label>
                            <select id="editParentId" class="form-control">
                                <option value="">Nenhuma (categoria raiz)</option>
                                ${getCategoriasOptions(categoria.id, categoria.parent_id)}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editOrdem">Ordem</label>
                            <input type="number" id="editOrdem" class="form-control" value="${categoria.ordem || 0}" min="0">
                        </div>
                        <div class="form-group">
                            <div class="checkbox">
                                <label>
                                    <input type="checkbox" id="editAtivo" ${categoria.ativo ? 'checked' : ''}>
                                    Categoria Ativa
                                </label>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button onclick="saveEdicaoCategoria()" class="btn btn-primary">
                    <i class="fas fa-save"></i> Salvar
                </button>
                <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Configurar color picker no modal
    setTimeout(() => {
        const editCorInput = document.getElementById('editCor');
        const editCorTextInput = document.getElementById('editCorText');
        
        if (editCorInput && editCorTextInput) {
            editCorInput.addEventListener('input', (e) => {
                editCorTextInput.value = e.target.value;
            });
            
            editCorTextInput.addEventListener('input', (e) => {
                if (e.target.value.match(/^#[0-9A-F]{6}$/i)) {
                    editCorInput.value = e.target.value;
                }
            });
        }
    }, 100);
}

function getCategoriasOptions(excludeId, selectedParentId) {
    // Filtra categorias para não permitir que uma categoria seja pai dela mesma
    const options = categorias
        .filter(cat => cat.id !== excludeId)
        .map(cat => {
            const selected = cat.id === selectedParentId ? 'selected' : '';
            return `<option value="${cat.id}" ${selected}>${cat.nome}</option>`;
        });
    
    return options.join('');
}

async function saveEdicaoCategoria() {
    // Função segura para obter valor do campo no modal
    const getEditValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    };

    const getEditChecked = (id) => {
        const element = document.getElementById(id);
        return element ? element.checked : true;
    };

    const categoria = {
        nome: getEditValue('editNome'),
        descricao: getEditValue('editDescricao'),
        cor: getEditValue('editCorText'),
        parent_id: getEditValue('editParentId') || null,
        ordem: parseInt(getEditValue('editOrdem')) || 0,
        ativo: getEditChecked('editAtivo')
    };

    try {
        const { error } = await window.supabase
            .from('categorias')
            .update(categoria)
            .eq('id', editingId);

        if (error) throw error;

        showNotification('Categoria atualizada com sucesso!', 'success');
        document.querySelector('.modal.show').remove();
        await loadCategorias();
    } catch (error) {
        console.error('Erro ao atualizar categoria:', error);
        showNotification('Erro ao atualizar categoria: ' + error.message, 'error');
    }
}

async function deleteCategoria(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${nome}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        // Verificar se existem subcategorias
        const { data: subcategorias } = await window.supabase
            .from('categorias')
            .select('id')
            .eq('parent_id', id);
        
        if (subcategorias && subcategorias.length > 0) {
            if (!confirm(`Esta categoria possui ${subcategorias.length} subcategoria(s).\nDeseja excluir mesmo assim?`)) {
                return;
            }
        }

        const { error } = await window.supabase
            .from('categorias')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('Categoria excluída com sucesso!', 'success');
        await loadCategorias();
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showNotification('Erro ao excluir categoria', 'error');
    }
}

// Garantir que as funções estão disponíveis globalmente
if (typeof window.editCategoria === 'undefined') {
    window.editCategoria = editCategoria;
}

if (typeof window.deleteCategoria === 'undefined') {
    window.deleteCategoria = deleteCategoria;
}

if (typeof window.saveEdicaoCategoria === 'undefined') {
    window.saveEdicaoCategoria = saveEdicaoCategoria;
}

console.log('Categorias.js carregado com sucesso!');