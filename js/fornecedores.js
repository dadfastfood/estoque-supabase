// ============================================
// FORNECEDORES.JS - CÓDIGO CORRIGIDO
// ============================================

let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de Fornecedores carregada');
    
    // Aguarda o Supabase ficar pronto
    await waitForSupabase();
    
    if (!window.isSupabaseReady()) {
        showNotification('Erro: Sistema não inicializado', 'error');
        return;
    }
    
    await loadFornecedores();
    setupEventListeners();
    setupSearch();
    setupMasks();
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

function setupMasks() {
    // Máscaras para campos específicos
    const cnpjCpfInput = document.getElementById('cnpj_cpf');
    const telefoneInput = document.getElementById('telefone');
    const contatoTelefoneInput = document.getElementById('contato_telefone');
    const cepInput = document.getElementById('cep');
    
    if (cnpjCpfInput) {
        cnpjCpfInput.addEventListener('input', (e) => {
            e.target.value = formatarCNPJCPF(e.target.value);
        });
    }
    
    if (telefoneInput) {
        telefoneInput.addEventListener('input', (e) => {
            e.target.value = formatarTelefone(e.target.value);
        });
    }
    
    if (contatoTelefoneInput) {
        contatoTelefoneInput.addEventListener('input', (e) => {
            e.target.value = formatarTelefone(e.target.value);
        });
    }
    
    if (cepInput) {
        cepInput.addEventListener('input', (e) => {
            e.target.value = formatarCEP(e.target.value);
        });
    }
}

function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Formulário principal - VERIFICAÇÃO DE SEGURANÇA
    const fornecedorForm = document.getElementById('fornecedorForm');
    if (fornecedorForm) {
        console.log('Formulário encontrado, adicionando event listener');
        fornecedorForm.addEventListener('submit', handleSubmit);
    } else {
        console.warn('Formulário fornecedorForm não encontrado! Verifique o HTML.');
    }
    
    // Botão limpar - VERIFICAÇÃO DE SEGURANÇA
    const btnLimpar = document.getElementById('btnLimpar');
    if (btnLimpar) {
        console.log('Botão limpar encontrado');
        btnLimpar.addEventListener('click', () => {
            resetForm('fornecedorForm');
        });
    } else {
        console.warn('Botão btnLimpar não encontrado!');
    }
    
    // Buscar CEP automaticamente
    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('blur', buscarCEP);
    }
}

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadFornecedores(e.target.value);
            }, 300);
        });
    }
}

async function buscarCEP() {
    const cepInput = document.getElementById('cep');
    const enderecoInput = document.getElementById('endereco');
    const bairroInput = document.getElementById('bairro');
    const cidadeInput = document.getElementById('cidade');
    const estadoInput = document.getElementById('estado');
    
    const cep = cepInput.value.replace(/\D/g, '');
    
    if (cep.length !== 8) {
        return;
    }
    
    try {
        showNotification('Buscando CEP...', 'info');
        
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
            enderecoInput.value = data.logradouro || '';
            bairroInput.value = data.bairro || '';
            cidadeInput.value = data.localidade || '';
            estadoInput.value = data.uf || '';
            showNotification('CEP encontrado!', 'success');
        } else {
            showNotification('CEP não encontrado', 'warning');
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        showNotification('Erro ao buscar CEP', 'error');
    }
}

async function loadFornecedores(searchTerm = '') {
    try {
        console.log('Carregando fornecedores...');
        let query = window.supabase
            .from('fornecedores')
            .select('*')
            .order('nome');

        if (searchTerm) {
            query = query.or(`nome.ilike.%${searchTerm}%,razao_social.ilike.%${searchTerm}%,cnpj_cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
        }

        const { data: fornecedores, error } = await query;

        if (error) throw error;

        renderFornecedoresTable(fornecedores);
    } catch (error) {
        console.error('Erro ao carregar fornecedores:', error);
        showNotification('Erro ao carregar fornecedores', 'error');
    }
}

function renderFornecedoresTable(fornecedores) {
    const tbody = document.getElementById('fornecedoresTable');
    
    if (!tbody) {
        console.error('Tabela fornecedoresTable não encontrada no HTML');
        return;
    }
    
    if (!fornecedores || fornecedores.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" class="empty-state">
                    <i class="fas fa-truck"></i>
                    <p>Nenhum fornecedor encontrado</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = fornecedores.map(fornecedor => {
        const statusClass = fornecedor.ativo ? 'badge-success' : 'badge-danger';
        const statusText = fornecedor.ativo ? 'Ativo' : 'Inativo';
        const cnpjCpfFormatado = fornecedor.cnpj_cpf ? formatarCNPJCPF(fornecedor.cnpj_cpf) : '-';
        const telefoneFormatado = fornecedor.telefone ? formatarTelefone(fornecedor.telefone) : '-';
        const cidadeEstado = fornecedor.cidade && fornecedor.estado ? 
            `${fornecedor.cidade}/${fornecedor.estado}` : '-';
        
        return `
            <tr>
                <td>
                    <strong>${fornecedor.nome}</strong>
                    ${fornecedor.razao_social ? `<br><small class="text-muted">${fornecedor.razao_social}</small>` : ''}
                </td>
                <td>${cnpjCpfFormatado}</td>
                <td>${telefoneFormatado}</td>
                <td>${fornecedor.email || '-'}</td>
                <td>${cidadeEstado}</td>
                <td>${fornecedor.contato_nome || '-'}</td>
                <td>
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
                <td class="text-right">
                    ${fornecedor.created_at ? formatDate(fornecedor.created_at) : '-'}
                </td>
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
        `;
    }).join('');
}

async function handleSubmit(event) {
    event.preventDefault();
    
    // Verifica se validateForm existe, senão usa validação básica
    let formIsValid;
    if (typeof validateForm === 'function') {
        formIsValid = validateForm('fornecedorForm');
    } else {
        // Validação básica como fallback
        formIsValid = validateFormBasic('fornecedorForm');
    }
    
    if (!formIsValid) {
        showNotification('Preencha todos os campos obrigatórios corretamente', 'warning');
        return;
    }
    
    const fornecedor = {
        nome: document.getElementById('nome').value.trim(),
        razao_social: document.getElementById('razao_social').value.trim() || null,
        cnpj_cpf: document.getElementById('cnpj_cpf').value.trim().replace(/\D/g, '') || null,
        inscricao_estadual: document.getElementById('inscricao_estadual').value.trim() || null,
        telefone: document.getElementById('telefone').value.trim().replace(/\D/g, '') || null,
        email: document.getElementById('email').value.trim() || null,
        endereco: document.getElementById('endereco').value.trim() || null,
        numero: document.getElementById('numero').value.trim() || null,
        complemento: document.getElementById('complemento').value.trim() || null,
        bairro: document.getElementById('bairro').value.trim() || null,
        cidade: document.getElementById('cidade').value.trim() || null,
        estado: document.getElementById('estado').value.trim() || null,
        cep: document.getElementById('cep').value.trim().replace(/\D/g, '') || null,
        contato_nome: document.getElementById('contato_nome').value.trim() || null,
        contato_telefone: document.getElementById('contato_telefone').value.trim().replace(/\D/g, '') || null,
        contato_email: document.getElementById('contato_email').value.trim() || null,
        observacoes: document.getElementById('observacoes').value.trim() || null,
        ativo: document.getElementById('ativo').checked
    };

    try {
        const { error } = await window.supabase
            .from('fornecedores')
            .insert([fornecedor]);

        if (error) throw error;

        showNotification('Fornecedor cadastrado com sucesso!', 'success');
        resetForm('fornecedorForm');
        await loadFornecedores();
    } catch (error) {
        console.error('Erro ao cadastrar fornecedor:', error);
        showNotification('Erro ao cadastrar fornecedor: ' + error.message, 'error');
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

function resetForm(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        form.querySelectorAll('.form-control').forEach(input => {
            input.classList.remove('error', 'success');
        });
    }
}

async function editFornecedor(id) {
    try {
        const { data: fornecedor, error } = await window.supabase
            .from('fornecedores')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        editingId = id;
        openEditModal(fornecedor);
    } catch (error) {
        console.error('Erro ao carregar fornecedor:', error);
        showNotification('Erro ao carregar fornecedor', 'error');
    }
}

function openEditModal(fornecedor) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Editar Fornecedor</h3>
                <button onclick="this.closest('.modal').remove()" class="btn btn-sm">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="editFornecedorForm">
                    <input type="hidden" id="editId" value="${fornecedor.id}">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="editNome">Nome *</label>
                            <input type="text" id="editNome" class="form-control" value="${fornecedor.nome || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editRazaoSocial">Razão Social</label>
                            <input type="text" id="editRazaoSocial" class="form-control" value="${fornecedor.razao_social || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editCnpjCpf">CNPJ/CPF</label>
                            <input type="text" id="editCnpjCpf" class="form-control" value="${formatarCNPJCPF(fornecedor.cnpj_cpf || '')}">
                        </div>
                        <div class="form-group">
                            <label for="editInscricaoEstadual">Inscrição Estadual</label>
                            <input type="text" id="editInscricaoEstadual" class="form-control" value="${fornecedor.inscricao_estadual || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editTelefone">Telefone</label>
                            <input type="text" id="editTelefone" class="form-control" value="${formatarTelefone(fornecedor.telefone || '')}">
                        </div>
                        <div class="form-group">
                            <label for="editEmail">Email</label>
                            <input type="email" id="editEmail" class="form-control" value="${fornecedor.email || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editEndereco">Endereço</label>
                            <input type="text" id="editEndereco" class="form-control" value="${fornecedor.endereco || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editNumero">Número</label>
                            <input type="text" id="editNumero" class="form-control" value="${fornecedor.numero || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editComplemento">Complemento</label>
                            <input type="text" id="editComplemento" class="form-control" value="${fornecedor.complemento || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editBairro">Bairro</label>
                            <input type="text" id="editBairro" class="form-control" value="${fornecedor.bairro || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editCidade">Cidade</label>
                            <input type="text" id="editCidade" class="form-control" value="${fornecedor.cidade || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editEstado">Estado</label>
                            <select id="editEstado" class="form-control">
                                <option value="">Selecione...</option>
                                ${getEstadosOptions(fornecedor.estado || '')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editCep">CEP</label>
                            <input type="text" id="editCep" class="form-control" value="${formatarCEP(fornecedor.cep || '')}">
                        </div>
                        <div class="form-group">
                            <label for="editContatoNome">Nome do Contato</label>
                            <input type="text" id="editContatoNome" class="form-control" value="${fornecedor.contato_nome || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editContatoTelefone">Telefone do Contato</label>
                            <input type="text" id="editContatoTelefone" class="form-control" value="${formatarTelefone(fornecedor.contato_telefone || '')}">
                        </div>
                        <div class="form-group">
                            <label for="editContatoEmail">Email do Contato</label>
                            <input type="email" id="editContatoEmail" class="form-control" value="${fornecedor.contato_email || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editObservacoes">Observações</label>
                            <textarea id="editObservacoes" class="form-control" rows="3">${fornecedor.observacoes || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <div class="checkbox">
                                <label>
                                    <input type="checkbox" id="editAtivo" ${fornecedor.ativo ? 'checked' : ''}>
                                    Fornecedor Ativo
                                </label>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button onclick="saveEdicaoFornecedor()" class="btn btn-primary">
                    <i class="fas fa-save"></i> Salvar
                </button>
                <button onclick="this.closest('.modal').remove()" class="btn btn-secondary">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Configurar máscaras e eventos no modal
    setTimeout(() => {
        const editCnpjCpf = document.getElementById('editCnpjCpf');
        const editTelefone = document.getElementById('editTelefone');
        const editContatoTelefone = document.getElementById('editContatoTelefone');
        const editCep = document.getElementById('editCep');
        
        if (editCnpjCpf) {
            editCnpjCpf.addEventListener('input', (e) => {
                e.target.value = formatarCNPJCPF(e.target.value);
            });
        }
        
        if (editTelefone) {
            editTelefone.addEventListener('input', (e) => {
                e.target.value = formatarTelefone(e.target.value);
            });
        }
        
        if (editContatoTelefone) {
            editContatoTelefone.addEventListener('input', (e) => {
                e.target.value = formatarTelefone(e.target.value);
            });
        }
        
        if (editCep) {
            editCep.addEventListener('input', (e) => {
                e.target.value = formatarCEP(e.target.value);
            });
            
            editCep.addEventListener('blur', async (e) => {
                const cep = e.target.value.replace(/\D/g, '');
                if (cep.length === 8) {
                    await buscarCEPModal(cep);
                }
            });
        }
    }, 100);
}

function getEstadosOptions(selectedEstado) {
    const estados = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
        'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
        'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
    ];
    
    return estados.map(estado => 
        `<option value="${estado}" ${estado === selectedEstado ? 'selected' : ''}>${estado}</option>`
    ).join('');
}

async function buscarCEPModal(cep) {
    const editEndereco = document.getElementById('editEndereco');
    const editBairro = document.getElementById('editBairro');
    const editCidade = document.getElementById('editCidade');
    const editEstado = document.getElementById('editEstado');
    
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (!data.erro) {
            editEndereco.value = data.logradouro || '';
            editBairro.value = data.bairro || '';
            editCidade.value = data.localidade || '';
            editEstado.value = data.uf || '';
        }
    } catch (error) {
        console.error('Erro ao buscar CEP no modal:', error);
    }
}

async function saveEdicaoFornecedor() {
    const fornecedor = {
        nome: document.getElementById('editNome').value.trim(),
        razao_social: document.getElementById('editRazaoSocial').value.trim() || null,
        cnpj_cpf: document.getElementById('editCnpjCpf').value.trim().replace(/\D/g, '') || null,
        inscricao_estadual: document.getElementById('editInscricaoEstadual').value.trim() || null,
        telefone: document.getElementById('editTelefone').value.trim().replace(/\D/g, '') || null,
        email: document.getElementById('editEmail').value.trim() || null,
        endereco: document.getElementById('editEndereco').value.trim() || null,
        numero: document.getElementById('editNumero').value.trim() || null,
        complemento: document.getElementById('editComplemento').value.trim() || null,
        bairro: document.getElementById('editBairro').value.trim() || null,
        cidade: document.getElementById('editCidade').value.trim() || null,
        estado: document.getElementById('editEstado').value || null,
        cep: document.getElementById('editCep').value.trim().replace(/\D/g, '') || null,
        contato_nome: document.getElementById('editContatoNome').value.trim() || null,
        contato_telefone: document.getElementById('editContatoTelefone').value.trim().replace(/\D/g, '') || null,
        contato_email: document.getElementById('editContatoEmail').value.trim() || null,
        observacoes: document.getElementById('editObservacoes').value.trim() || null,
        ativo: document.getElementById('editAtivo').checked
    };

    try {
        const { error } = await window.supabase
            .from('fornecedores')
            .update(fornecedor)
            .eq('id', editingId);

        if (error) throw error;

        showNotification('Fornecedor atualizado com sucesso!', 'success');
        document.querySelector('.modal.show').remove();
        await loadFornecedores();
    } catch (error) {
        console.error('Erro ao atualizar fornecedor:', error);
        showNotification('Erro ao atualizar fornecedor: ' + error.message, 'error');
    }
}

async function deleteFornecedor(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o fornecedor "${nome}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        const { error } = await window.supabase
            .from('fornecedores')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('Fornecedor excluído com sucesso!', 'success');
        await loadFornecedores();
    } catch (error) {
        console.error('Erro ao excluir fornecedor:', error);
        showNotification('Erro ao excluir fornecedor', 'error');
    }
}

// Garantir que as funções estão disponíveis globalmente
if (typeof window.editFornecedor === 'undefined') {
    window.editFornecedor = editFornecedor;
}

if (typeof window.deleteFornecedor === 'undefined') {
    window.deleteFornecedor = deleteFornecedor;
}

if (typeof window.saveEdicaoFornecedor === 'undefined') {
    window.saveEdicaoFornecedor = saveEdicaoFornecedor;
}

console.log('Fornecedores.js carregado com sucesso!');