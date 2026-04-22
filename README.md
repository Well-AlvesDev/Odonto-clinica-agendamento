# 🦷 Sistema de Agendamento para Clínica Odontológica

Um sistema web moderno e responsivo para gerenciamento de agendamentos odontológicos, desenvolvido com HTML5, CSS3, JavaScript vanilla e Supabase.

## 📋 Descrição

Este projeto é uma solução completa de agendamento para clínicas odontológicas, permitindo que pacientes marquem consultas e que administradores gerenciem agendamentos, serviços, relatórios e análises de faturamento.

## ✨ Funcionalidades Principais

### 👥 Para Pacientes
- ✅ Agendamento de consultas online
- ✅ Seleção de serviços disponíveis
- ✅ Escolha de data e horário
- ✅ Cancelamento de agendamentos (com 2+ horas de antecedência)
- ✅ Visualização de próximos agendamentos
- ✅ Interface responsiva e intuitiva

### 🔧 Para Administradores
- ✅ Painel administrativo com autenticação segura
- ✅ Gerenciamento completo de agendamentos
- ✅ Cadastro e exclusão de serviços
- ✅ Controle de horários e disponibilidade
- ✅ Gráficos de agendamentos por serviço
- ✅ Relatórios de faturamento (7 dias, 30 dias, 12 meses)
- ✅ Paginação eficiente de consultas
- ✅ Impressão de relatórios
- ✅ Limpeza automática de datas antigas

## 🛠️ Tecnologias Utilizadas

| Tecnologia | Descrição |
|-----------|-----------|
| **HTML5** | Estrutura da aplicação |
| **CSS3** | Estilização responsiva |
| **JavaScript (Vanilla)** | Lógica da aplicação |
| **Supabase** | Backend, autenticação e banco de dados PostgreSQL |
| **Chart.js** | Geração de gráficos e relatórios |
| **RemixIcon** | Ícones vetoriais |
| **Service Workers** | Cache e funcionamento offline |

## 📁 Estrutura do Projeto

```
agendamento-clinica-odonto/
├── index.html                 # Página principal
├── sw.js                      # Service Worker
├── README.md                  # Este arquivo
├── finalizeV1.0.md            # Documentação de versão
│
├── administrativo/            # Painel administrativo
│   ├── login.html            # Login de admin
│   ├── home.html             # Dashboard
│   ├── agnd.html             # Gerenciamento de agendamentos
│   ├── config.html           # Configuração de serviços
│   └── graphl.html           # Relatórios e gráficos
│
├── agendar/                   # Área de agendamento
│   └── index.html            # Formulário de agendamento
│
├── recursos/
│   ├── css/                  # Estilos
│   │   ├── geral.css         # Estilos gerais
│   │   ├── agnd.css          # Estilos de agendamentos
│   │   ├── config.css        # Estilos de configuração
│   │   ├── formulario.css    # Estilos de formulários
│   │   ├── graphl.css        # Estilos de gráficos
│   │   └── home.css          # Estilos do dashboard
│   │
│   ├── imgs/                 # Imagens e assets
│   │
│   └── js/                   # Scripts JavaScript
│       ├── supabase.js       # Integração com Supabase
│       ├── supabaseV2.js     # Versão otimizada do Supabase
│       ├── geral.js          # Funções gerais
│       ├── config.js         # Configurações
│       ├── cache-manager.js  # Gerenciamento de cache
│       └── modalCancelamento.js  # Modal de cancelamento
│
└── sql/                      # Scripts SQL
    ├── o1.sql - o15.sql      # 15 procedures e functions PostgreSQL

```
**Versão Atual**: 1.0  
**Última Atualização**: Abril 2026  
**Desenvolvido com ❤️ por [KHOLSON DESENVOLVIMENTO WEB]()**

NÃO DISPONIBILIZAMOS OS ARQUIVOS SQL PUBLICAMENTE. ---------------