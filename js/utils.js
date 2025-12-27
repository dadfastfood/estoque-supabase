// Função para mostrar notificações
function showNotification(message, type = 'info') {
    // Remove notificação anterior se existir
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">&times;</button>
    `;

    // Estilos da notificação
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 6px;
        color: white;
        font-weight: 600;
        display: flex;
        align-items: center;
        justify-content: space-between;
        min-width: 300px;
        max-width: 400px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    // Cores baseadas no tipo
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };

    notification.style.backgroundColor = colors[type] || colors.info;

    // Estilo do botão de fechar
    notification.querySelector('button').style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        margin-left: 1rem;
        padding: 0;
        line-height: 1;
    `;

    document.body.appendChild(notification);

    // Remover automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// utils.js - Adicione estas funções se não existirem

// Função para formatar moeda
window.formatCurrency = function(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
};

// Função para formatar número
window.formatNumber = function(value, decimals = 2) {
    return new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value || 0);
};

// Função para formatar data
window.formatDate = function(dateString) {
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

// utils.js - Adicionar funções de validação

// Função para validar formulários
window.validateForm = function(formId) {
    const form = document.getElementById(formId);
    if (!form) {
        console.error(`Formulário com ID ${formId} não encontrado`);
        return false;
    }
    
    const inputs = form.querySelectorAll('[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            input.classList.add('error');
            isValid = false;
        } else {
            input.classList.remove('error');
        }
        
        // Validação específica para email
        if (input.type === 'email' && input.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(input.value.trim())) {
                input.classList.add('error');
                isValid = false;
            }
        }
        
        // Validação para CNPJ/CPF
        if (input.id === 'cnpj_cpf' && input.value.trim()) {
            const cnpjCpf = input.value.trim().replace(/\D/g, '');
            if (!validarCNPJCPF(cnpjCpf)) {
                input.classList.add('error');
                isValid = false;
            }
        }
    });
    
    return isValid;
};

// Função para validar CNPJ/CPF
window.validarCNPJCPF = function(valor) {
    const str = valor.replace(/\D/g, '');
    
    // Verifica se é CPF (11 dígitos) ou CNPJ (14 dígitos)
    if (str.length === 11) {
        return validarCPF(str);
    } else if (str.length === 14) {
        return validarCNPJ(str);
    }
    return false;
};

// Função para validar CPF
function validarCPF(cpf) {
    cpf = cpf.replace(/[^\d]+/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    
    let soma = 0;
    let resto;
    
    for (let i = 1; i <= 9; i++) {
        soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    }
    
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    
    soma = 0;
    for (let i = 1; i <= 10; i++) {
        soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    }
    
    resto = (soma * 10) % 11;
    if ((resto === 10) || (resto === 11)) resto = 0;
    if (resto !== parseInt(cpf.substring(10, 11))) return false;
    
    return true;
}

// Função para validar CNPJ
function validarCNPJ(cnpj) {
    cnpj = cnpj.replace(/[^\d]+/g, '');
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    
    let tamanho = cnpj.length - 2;
    let numeros = cnpj.substring(0, tamanho);
    let digitos = cnpj.substring(tamanho);
    let soma = 0;
    let pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(0))) return false;
    
    tamanho = tamanho + 1;
    numeros = cnpj.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    
    for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
    }
    
    resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
    if (resultado !== parseInt(digitos.charAt(1))) return false;
    
    return true;
};

// Função para formatar CNPJ/CPF
window.formatarCNPJCPF = function(valor) {
    const str = valor.replace(/\D/g, '');
    
    if (str.length === 11) {
        // CPF: 000.000.000-00
        return str.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (str.length === 14) {
        // CNPJ: 00.000.000/0000-00
        return str.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    
    return valor;
};

// Função para formatar telefone
window.formatarTelefone = function(valor) {
    const str = valor.replace(/\D/g, '');
    
    if (str.length === 10) {
        // (00) 0000-0000
        return str.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else if (str.length === 11) {
        // (00) 00000-0000
        return str.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    
    return valor;
};

// Função para formatar CEP
window.formatarCEP = function(valor) {
    const str = valor.replace(/\D/g, '');
    
    if (str.length === 8) {
        return str.replace(/(\d{5})(\d{3})/, '$1-$2');
    }
    
    return valor;
};

// utils.js - Funções de Formulário (adicione estas funções)

// Função para resetar formulário
window.resetForm = function(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.reset();
        form.querySelectorAll('.form-control').forEach(input => {
            input.classList.remove('error', 'success');
        });
    }
};

// Função para limpar erros do formulário
window.clearFormErrors = function(formId) {
    const form = document.getElementById(formId);
    if (form) {
        form.querySelectorAll('.form-control.error').forEach(input => {
            input.classList.remove('error');
        });
    }
};

// Função para mostrar erros em campos específicos
window.showFieldError = function(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.add('error');
        
        // Adiciona mensagem de erro
        let errorElement = field.parentElement.querySelector('.error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'error-message';
            field.parentElement.appendChild(errorElement);
        }
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
};

// Função para limpar erro de campo específico
window.clearFieldError = function(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.classList.remove('error');
        
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }
};

// Função para validar email
window.validateEmail = function(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
};

// Função para validar telefone
window.validatePhone = function(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 11;
};

// Função para validar CEP
window.validateCEP = function(cep) {
    const cleaned = cep.replace(/\D/g, '');
    return cleaned.length === 8;
};

// Função para gerar código automático
window.generateCode = function(prefix = 'DEP', length = 4) {
    const timestamp = Date.now().toString().slice(-length);
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `${prefix}${timestamp}${random}`;
};

// Função para capitalizar texto
window.capitalize = function(text) {
    return text.replace(/\b\w/g, char => char.toUpperCase());
};

// Função para formatar capacidade
window.formatCapacity = function(capacity) {
    if (!capacity) return '';
    
    // Remove caracteres não numéricos
    const num = capacity.replace(/[^\d,.]/g, '');
    if (!num) return capacity;
    
    // Tenta identificar a unidade
    if (capacity.toLowerCase().includes('kg') || capacity.toLowerCase().includes('kilo')) {
        return `${parseFloat(num).toLocaleString('pt-BR')} kg`;
    } else if (capacity.toLowerCase().includes('ton') || capacity.toLowerCase().includes('tonelada')) {
        return `${parseFloat(num).toLocaleString('pt-BR')} ton`;
    } else if (capacity.toLowerCase().includes('m³') || capacity.toLowerCase().includes('metro')) {
        return `${parseFloat(num).toLocaleString('pt-BR')} m³`;
    } else if (capacity.toLowerCase().includes('litro') || capacity.toLowerCase().includes('l')) {
        return `${parseFloat(num).toLocaleString('pt-BR')} L`;
    } else if (capacity.toLowerCase().includes('palete')) {
        return `${parseFloat(num).toLocaleString('pt-BR')} paletes`;
    }
    
    return capacity;
};

// Adicionar estilos de animação
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    .stock-value.warning {
        color: #f59e0b;
        font-weight: bold;
    }

    .action-buttons {
        display: flex;
        gap: 5px;
    }

    .search-box {
        position: relative;
        width: 300px;
    }

    .search-box i {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: #6b7280;
    }

    .search-box input {
        padding-left: 35px;
    }

    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0,0,0,0.5);
        z-index: 1000;
    }

    .modal-content {
        background: white;
        margin: 50px auto;
        padding: 2rem;
        border-radius: 10px;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
    }

    .modal-actions {
        display: flex;
        gap: 1rem;
        justify-content: flex-end;
        margin-top: 2rem;
    }
`;
document.head.appendChild(style);