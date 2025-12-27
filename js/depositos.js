// ============================================
// DEPOSITOS.JS - CÓDIGO COMPLETAMENTE CORRIGIDO
// ============================================

let editingId = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Página de Depósitos carregada');
    
    // Aguarda o Supabase ficar pronto
    await waitForSupabase();
    
    if (!window.isSupabaseReady()) {
        showNotification('Erro: Sistema não inicializado', 'error');
        return;
    }
    
    await loadDepositos();
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
    const telefoneInput = document.getElementById('telefone');
    const cepInput = document.getElementById('cep');
    
    if (telefoneInput) {
        telefoneInput.addEventListener('input', (e) => {
            e.target.value = formatarTelefone(e.target.value);
        });
    }
    
    if (cepInput) {
        cepInput.addEventListener('input', (e) => {
            e.target.value = formatarCEP(e.target.value);
        });
    }
    
    // Gerar código automático se o campo estiver vazio
    const codigoInput = document.getElementById('codigo');
    if (codigoInput && !codigoInput.value) {
        codigoInput.value = generateCode('DEP', 4);
    }
}

function setupEventListeners() {
    console.log('Configurando event listeners...');
    
    // Formulário principal - VERIFICAÇÃO DE SEGURANÇA
    const depositoForm = document.getElementById('depositoForm');
    if (depositoForm) {
        console.log('Formulário encontrado, adicionando event listener');
        depositoForm.addEventListener('submit', handleSubmit);
    } else {
        console.warn('Formulário depositoForm não encontrado! Verifique o HTML.');
    }
    
    // Botão limpar - VERIFICAÇÃO DE SEGURANÇA
    const btnLimpar = document.getElementById('btnLimpar');
    if (btnLimpar) {
        console.log('Botão limpar encontrado');
        btnLimpar.addEventListener('click', () => {
            if (typeof resetForm === 'function') {
                resetForm('depositoForm');
                // Regera o código se o campo estiver vazio
                const codigoInput = document.getElementById('codigo');
                if (codigoInput && !codigoInput.value) {
                    codigoInput.value = generateCode('DEP', 4);
                }
            } else {
                console.error('Função resetForm não disponível!');
                showNotification('Erro: Função resetForm não disponível', 'error');
            }
        });
    } else {
        console.warn('Botão btnLimpar não encontrado!');
    }
    
    // Botão gerar código
    const btnGerarCodigo = document.getElementById('btnGerarCodigo');
    if (btnGerarCodigo) {
        btnGerarCodigo.addEventListener('click', () => {
            const codigoInput = document.getElementById('codigo');
            if (codigoInput) {
                codigoInput.value = generateCode('DEP', 4);
            }
        });
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
                loadDepositos(e.target.value);
            }, 300);
        });
    }
}

async function buscarCEP() {
    const cepInput = document.getElementById('cep');
    const enderecoInput = document.getElementById('endereco');
    const bairroInput = document.getElementById('bairro');
    const cidadeInput = document.getElementById('cidade');
    const estadoSelect = document.getElementById('estado');
    
    if (!cepInput || !enderecoInput || !bairroInput || !cidadeInput || !estadoSelect) {
        console.warn('Elementos para busca de CEP não encontrados');
        return;
    }
    
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
            
            // Define o estado no select
            if (estadoSelect && data.uf) {
                estadoSelect.value = data.uf;
            }
            
            showNotification('CEP encontrado!', 'success');
        } else {
            showNotification('CEP não encontrado', 'warning');
        }
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        showNotification('Erro ao buscar CEP', 'error');
    }
}

async function loadDepositos(searchTerm = '') {
    try {
        console.log('Carregando depósitos...');
        let query = window.supabase
            .from('depositos')
            .select('*')
            .order('nome');

        if (searchTerm) {
            query = query.or(`nome.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%,responsavel.ilike.%${searchTerm}%`);
        }

        const { data: depositos, error } = await query;

        if (error) throw error;

        renderDepositosTable(depositos);
    } catch (error) {
        console.error('Erro ao carregar depósitos:', error);
        showNotification('Erro ao carregar depósitos', 'error');
    }
}

function renderDepositosTable(depositos) {
    const tbody = document.getElementById('depositosTable');
    
    if (!tbody) {
        console.error('Tabela depositosTable não encontrada no HTML');
        return;
    }
    
    if (!depositos || depositos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fas fa-warehouse"></i>
                    <p>Nenhum depósito encontrado</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = depositos.map(deposito => {
        const statusClass = deposito.ativo ? 'badge-success' : 'badge-danger';
        const statusText = deposito.ativo ? 'Ativo' : 'Inativo';
        const capacidadeFormatada = formatCapacity(deposito.capacidade);
        const enderecoCompleto = deposito.endereco ? 
            `${deposito.endereco}${deposito.numero ? ', ' + deposito.numero : ''}${deposito.complemento ? ' - ' + deposito.complemento : ''}` : '-';
        const cidadeEstado = deposito.cidade && deposito.estado ? 
            `${deposito.cidade}/${deposito.estado}` : '-';
        const telefoneFormatado = deposito.telefone ? formatarTelefone(deposito.telefone) : '-';
        
        return `
            <tr>
                <td>
                    <strong>${deposito.nome}</strong>
                    ${deposito.codigo ? `<br><small class="text-muted">${deposito.codigo}</small>` : ''}
                </td>
                <td>${deposito.responsavel || '-'}</td>
                <td>${telefoneFormatado}</td>
                <td>${enderecoCompleto}</td>
                <td>${cidadeEstado}</td>
                <td>${capacidadeFormatada}</td>
                <td>
                    <span class="badge ${statusClass}">${statusText}</span>
                </td>
                <td class="text-right">
                    ${deposito.created_at ? formatDate(deposito.created_at) : '-'}
                </td>
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
        `;
    }).join('');
}

async function handleSubmit(event) {
    event.preventDefault();
    
    // Verifica se validateForm existe, senão usa validação básica
    let formIsValid;
    if (typeof validateForm === 'function') {
        formIsValid = validateForm('depositoForm');
    } else {
        // Validação básica como fallback
        formIsValid = validateFormBasic('depositoForm');
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

    // Coletar dados de forma segura
    const deposito = {
        nome: getValue('nome'),
        codigo: getValue('codigo'),
        endereco: getValue('endereco'),
        numero: getValue('numero'),
        complemento: getValue('complemento'),
        bairro: getValue('bairro'),
        cidade: getValue('cidade'),
        estado: getValue('estado'),
        cep: getValue('cep').replace(/\D/g, ''),
        responsavel: getValue('responsavel'),
        telefone: getValue('telefone').replace(/\D/g, ''),
        capacidade: getValue('capacidade'),
        observacoes: getValue('observacoes'),
        ativo: getChecked('ativo')
    };

    // Validação manual dos campos obrigatórios
    if (!deposito.nome) {
        showNotification('O campo "Nome do Depósito" é obrigatório', 'warning');
        return;
    }

    try {
        const { error } = await window.supabase
            .from('depositos')
            .insert([deposito]);

        if (error) throw error;

        showNotification('Depósito cadastrado com sucesso!', 'success');
        
        // Resetar formulário de forma segura
        if (typeof resetForm === 'function') {
            resetForm('depositoForm');
            // Regera o código para o próximo cadastro
            const codigoInput = document.getElementById('codigo');
            if (codigoInput) {
                codigoInput.value = generateCode('DEP', 4);
            }
        } else {
            // Fallback se resetForm não estiver disponível
            const form = document.getElementById('depositoForm');
            if (form) form.reset();
        }
        
        await loadDepositos();
    } catch (error) {
        console.error('Erro ao cadastrar depósito:', error);
        showNotification('Erro ao cadastrar depósito: ' + error.message, 'error');
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

async function editDeposito(id) {
    try {
        const { data: deposito, error } = await window.supabase
            .from('depositos')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        editingId = id;
        openEditModal(deposito);
    } catch (error) {
        console.error('Erro ao carregar depósito:', error);
        showNotification('Erro ao carregar depósito', 'error');
    }
}

function openEditModal(deposito) {
    const modal = document.createElement('div');
    modal.className = 'modal show';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Editar Depósito</h3>
                <button onclick="this.closest('.modal').remove()" class="btn btn-sm">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="editDepositoForm">
                    <input type="hidden" id="editId" value="${deposito.id}">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="editNome">Nome *</label>
                            <input type="text" id="editNome" class="form-control" value="${deposito.nome || ''}" required>
                        </div>
                        <div class="form-group">
                            <label for="editCodigo">Código</label>
                            <input type="text" id="editCodigo" class="form-control" value="${deposito.codigo || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editEndereco">Endereço</label>
                            <input type="text" id="editEndereco" class="form-control" value="${deposito.endereco || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editNumero">Número</label>
                            <input type="text" id="editNumero" class="form-control" value="${deposito.numero || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editComplemento">Complemento</label>
                            <input type="text" id="editComplemento" class="form-control" value="${deposito.complemento || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editBairro">Bairro</label>
                            <input type="text" id="editBairro" class="form-control" value="${deposito.bairro || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editCidade">Cidade</label>
                            <input type="text" id="editCidade" class="form-control" value="${deposito.cidade || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editEstado">Estado</label>
                            <select id="editEstado" class="form-control">
                                <option value="">Selecione...</option>
                                ${getEstadosOptions(deposito.estado || '')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="editCep">CEP</label>
                            <input type="text" id="editCep" class="form-control" value="${formatarCEP(deposito.cep || '')}">
                        </div>
                        <div class="form-group">
                            <label for="editResponsavel">Responsável</label>
                            <input type="text" id="editResponsavel" class="form-control" value="${deposito.responsavel || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editTelefone">Telefone</label>
                            <input type="text" id="editTelefone" class="form-control" value="${formatarTelefone(deposito.telefone || '')}">
                        </div>
                        <div class="form-group">
                            <label for="editCapacidade">Capacidade</label>
                            <input type="text" id="editCapacidade" class="form-control" value="${deposito.capacidade || ''}">
                        </div>
                        <div class="form-group">
                            <label for="editObservacoes">Observações</label>
                            <textarea id="editObservacoes" class="form-control" rows="3">${deposito.observacoes || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <div class="checkbox">
                                <label>
                                    <input type="checkbox" id="editAtivo" ${deposito.ativo ? 'checked' : ''}>
                                    Depósito Ativo
                                </label>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button onclick="saveEdicaoDeposito()" class="btn btn-primary">
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
        const editTelefone = document.getElementById('editTelefone');
        const editCep = document.getElementById('editCep');
        
        if (editTelefone) {
            editTelefone.addEventListener('input', (e) => {
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
            if (editEndereco) editEndereco.value = data.logradouro || '';
            if (editBairro) editBairro.value = data.bairro || '';
            if (editCidade) editCidade.value = data.localidade || '';
            if (editEstado) editEstado.value = data.uf || '';
        }
    } catch (error) {
        console.error('Erro ao buscar CEP no modal:', error);
    }
}

async function saveEdicaoDeposito() {
    // Função segura para obter valor do campo no modal
    const getEditValue = (id) => {
        const element = document.getElementById(id);
        return element ? element.value.trim() : '';
    };

    const getEditChecked = (id) => {
        const element = document.getElementById(id);
        return element ? element.checked : true;
    };

    const deposito = {
        nome: getEditValue('editNome'),
        codigo: getEditValue('editCodigo'),
        endereco: getEditValue('editEndereco'),
        numero: getEditValue('editNumero'),
        complemento: getEditValue('editComplemento'),
        bairro: getEditValue('editBairro'),
        cidade: getEditValue('editCidade'),
        estado: getEditValue('editEstado'),
        cep: getEditValue('editCep').replace(/\D/g, ''),
        responsavel: getEditValue('editResponsavel'),
        telefone: getEditValue('editTelefone').replace(/\D/g, ''),
        capacidade: getEditValue('editCapacidade'),
        observacoes: getEditValue('editObservacoes'),
        ativo: getEditChecked('editAtivo')
    };

    try {
        const { error } = await window.supabase
            .from('depositos')
            .update(deposito)
            .eq('id', editingId);

        if (error) throw error;

        showNotification('Depósito atualizado com sucesso!', 'success');
        document.querySelector('.modal.show').remove();
        await loadDepositos();
    } catch (error) {
        console.error('Erro ao atualizar depósito:', error);
        showNotification('Erro ao atualizar depósito: ' + error.message, 'error');
    }
}

async function deleteDeposito(id, nome) {
    if (!confirm(`Tem certeza que deseja excluir o depósito "${nome}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        const { error } = await window.supabase
            .from('depositos')
            .delete()
            .eq('id', id);

        if (error) throw error;

        showNotification('Depósito excluído com sucesso!', 'success');
        await loadDepositos();
    } catch (error) {
        console.error('Erro ao excluir depósito:', error);
        showNotification('Erro ao excluir depósito', 'error');
    }
}

// Garantir que as funções estão disponíveis globalmente
if (typeof window.editDeposito === 'undefined') {
    window.editDeposito = editDeposito;
}

if (typeof window.deleteDeposito === 'undefined') {
    window.deleteDeposito = deleteDeposito;
}

if (typeof window.saveEdicaoDeposito === 'undefined') {
    window.saveEdicaoDeposito = saveEdicaoDeposito;
}

// Função de fallback para resetForm se não estiver no utils.js
if (typeof window.resetForm === 'undefined') {
    window.resetForm = function(formId) {
        const form = document.getElementById(formId);
        if (form) {
            form.reset();
            form.querySelectorAll('.form-control').forEach(input => {
                input.classList.remove('error', 'success');
            });
        }
    };
}

console.log('Depósitos.js carregado com sucesso!');