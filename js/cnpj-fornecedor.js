document.addEventListener('DOMContentLoaded', function() {
    const inputCnpj = document.getElementById('cnpj_cpf');

    // Escuta quando o usuário sai do campo (evento blur)
    inputCnpj.addEventListener('blur', async function() {
        // 1. Limpa a formatação (pontos, traços, barras)
        const rawValue = this.value.replace(/\D/g, '');

        // 2. Verifica se é um CNPJ (14 dígitos)
        // Se for CPF (11 dígitos) ou vazio, não faz a consulta de empresa
        if (rawValue.length !== 14) {
            return;
        }

        // Feedback visual de carregamento
        document.body.style.cursor = 'wait';
        inputCnpj.style.backgroundColor = '#f0f0f0';

        try {
            // 3. Consulta a BrasilAPI
            const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${rawValue}`);
            
            if (!response.ok) throw new Error('Erro na requisição');
            
            const data = await response.json();

            // 4. Preenche os campos do seu formulário
            // Usa o ID exato que está no seu HTML
            
            // Dados da Empresa
            document.getElementById('razao_social').value = data.razao_social;
            // Se não tiver fantasia, usa a razão social
            document.getElementById('nome').value = data.nome_fantasia || data.razao_social;
            
            // Contato principal da empresa (se disponível na Receita)
            if(data.ddd_telefone_1) {
                document.getElementById('telefone').value = `(${data.ddd_telefone_1}) ${data.telefone_1}`;
            }
            if(data.email) { // Verifica se existe email antes de preencher
                 document.getElementById('email').value = data.email;
            }

            // Endereço
            document.getElementById('cep').value = formatarCEP(data.cep); // Função opcional abaixo
            document.getElementById('endereco').value = data.logradouro;
            document.getElementById('numero').value = data.numero;
            document.getElementById('complemento').value = data.complemento;
            document.getElementById('bairro').value = data.bairro;
            document.getElementById('cidade').value = data.municipio;
            
            // Seleciona o Estado no <select> automaticamente
            document.getElementById('estado').value = data.uf;

            // Foca no campo número para conferência ou preenchimento
            document.getElementById('numero').focus();

        } catch (error) {
            console.error("Erro ao buscar CNPJ:", error);
            // Opcional: alert('CNPJ não encontrado ou inválido.');
        } finally {
            // Remove o feedback de carregamento
            document.body.style.cursor = 'default';
            inputCnpj.style.backgroundColor = '#fff';
        }
    });

    //Função para ativar salvamento por teclas
    document.addEventListener('keydown', function(event) {
        // Verifica se CTRL (ou Command no Mac) e 'S' foram pressionados
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
            
            // 1. Impede o comportamento padrão do navegador (Salvar página)
            event.preventDefault();

            // 2. Seleciona o formulário
            const form = document.getElementById('fornecedorForm');

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

// Função auxiliar simples para formatar o CEP visualmente
function formatarCEP(cep) {
    if (!cep) return '';
    return cep.replace(/(\d{5})(\d{3})/, '$1-$2');
}