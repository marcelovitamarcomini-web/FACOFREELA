import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';

import {
  institutionalChannels,
  institutionalEmail,
  institutionalInstagramHandle,
  institutionalInstagramUrl,
  institutionalLinkedinLabel,
  institutionalLinkedinUrl,
  institutionalSupportMailto,
} from '../lib/institutional';

type InfoBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'contacts' };

type InfoSection = {
  title: string;
  blocks: InfoBlock[];
};

type InfoPageContent = {
  title: string;
  intro: string;
  lastUpdated?: string;
  blocks?: InfoBlock[];
  sections?: InfoSection[];
  supportCopy?: string;
  showContactCards?: boolean;
  showOfficialReferences?: boolean;
};

const legalLastUpdated = '27 de março de 2026';

const termsSections: InfoSection[] = [
  {
    title: '1. Aceitação dos Termos',
    blocks: [
      {
        type: 'paragraph',
        text: 'Ao utilizar o Faço Freela, você concorda em cumprir estes Termos de Uso e toda a legislação aplicável.',
      },
      {
        type: 'paragraph',
        text: 'Caso não concorde com qualquer parte destes Termos, você não deve acessar, se cadastrar ou utilizar a plataforma.',
      },
    ],
  },
  {
    title: '2. Sobre o Faço Freela',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela é uma plataforma digital criada para facilitar a conexão entre clientes e freelancers, com foco em clareza, organização, praticidade e melhor acompanhamento do fluxo de contratação e prestação de serviços.',
      },
      {
        type: 'paragraph',
        text: 'A plataforma poderá disponibilizar funcionalidades como:',
      },
      {
        type: 'list',
        items: [
          'criação de conta e autenticação de usuários',
          'perfis de clientes e freelancers',
          'cadastro e gestão de solicitações',
          'troca de mensagens',
          'acompanhamento de interações',
          'recursos de organização e apoio operacional',
          'páginas institucionais, formulários de contato e áreas de suporte',
        ],
      },
      {
        type: 'paragraph',
        text: 'O Faço Freela pode evoluir, alterar, ampliar, reduzir ou reformular suas funcionalidades a qualquer momento, de acordo com critérios técnicos, operacionais, estratégicos ou legais.',
      },
    ],
  },
  {
    title: '3. Elegibilidade e uso da plataforma',
    blocks: [
      {
        type: 'paragraph',
        text: 'Ao utilizar o Faço Freela, você declara que:',
      },
      {
        type: 'list',
        items: [
          'possui capacidade legal para aceitar estes Termos',
          'fornecerá informações verdadeiras, completas e atualizadas',
          'utilizará a plataforma somente para finalidades lícitas e compatíveis com sua proposta',
        ],
      },
      {
        type: 'paragraph',
        text: 'O uso da plataforma por menores de idade deverá observar a legislação aplicável e, quando necessário, a supervisão ou representação por responsável legal.',
      },
    ],
  },
  {
    title: '4. Cadastro e conta do usuário',
    blocks: [
      {
        type: 'paragraph',
        text: 'Para acessar determinadas funcionalidades, poderá ser necessário criar uma conta.',
      },
      {
        type: 'paragraph',
        text: 'Ao se cadastrar, o usuário se compromete a:',
      },
      {
        type: 'list',
        items: [
          'fornecer dados corretos, completos e atualizados',
          'não criar conta com informações falsas ou enganosas',
          'manter a confidencialidade de login e senha',
          'comunicar prontamente qualquer uso não autorizado de sua conta',
          'não compartilhar credenciais com terceiros',
        ],
      },
      {
        type: 'paragraph',
        text: 'O usuário é responsável pelas atividades realizadas em sua conta, na medida em que decorram do uso de suas credenciais.',
      },
      {
        type: 'paragraph',
        text: 'O Faço Freela poderá solicitar atualização cadastral, confirmação de identidade ou medidas adicionais de segurança sempre que considerar necessário para proteção da plataforma, dos usuários ou da operação.',
      },
    ],
  },
  {
    title: '5. Responsabilidades do usuário',
    blocks: [
      {
        type: 'paragraph',
        text: 'Ao utilizar a plataforma, o usuário concorda em:',
      },
      {
        type: 'list',
        items: [
          'agir com boa-fé, respeito e responsabilidade',
          'utilizar a plataforma de acordo com sua finalidade',
          'não violar direitos de terceiros',
          'não praticar fraude, abuso ou comportamento indevido',
          'não utilizar a plataforma para fins ilícitos, enganosos, ofensivos ou abusivos',
          'respeitar as regras de segurança, funcionamento e uso adequado do sistema',
        ],
      },
      {
        type: 'paragraph',
        text: 'O usuário é exclusivamente responsável pelas informações, mensagens, conteúdos, propostas, descrições, interações e demais materiais inseridos ou enviados por meio da plataforma.',
      },
    ],
  },
  {
    title: '6. Condutas proibidas',
    blocks: [
      {
        type: 'paragraph',
        text: 'É proibido utilizar o Faço Freela para:',
      },
      {
        type: 'list',
        items: [
          'praticar fraude ou tentativa de fraude',
          'enviar conteúdo ilícito, ofensivo, discriminatório, ameaçador, difamatório ou enganoso',
          'utilizar identidade falsa ou se passar por outra pessoa',
          'violar direitos autorais, marcas, segredos comerciais ou outros direitos de terceiros',
          'disseminar spam, correntes, mensagens abusivas ou comunicações não autorizadas',
          'coletar dados de outros usuários sem autorização',
          'explorar falhas, vulnerabilidades ou brechas do sistema',
          'tentar acessar áreas restritas, contas de terceiros ou recursos protegidos',
          'usar robôs, scripts, automações abusivas ou mecanismos que prejudiquem a operação',
          'interferir na estabilidade, segurança ou integridade da plataforma',
        ],
      },
      {
        type: 'paragraph',
        text: 'O descumprimento destas regras poderá resultar em medidas como suspensão, limitação de acesso, bloqueio ou exclusão da conta, sem prejuízo das medidas legais cabíveis.',
      },
    ],
  },
  {
    title: '7. Relação entre clientes e freelancers',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela atua como plataforma digital de conexão, organização e apoio ao fluxo entre clientes e freelancers.',
      },
      {
        type: 'paragraph',
        text: 'Isso significa que a plataforma poderá facilitar:',
      },
      {
        type: 'list',
        items: [
          'a apresentação de perfis',
          'a visualização de serviços',
          'o contato inicial',
          'a organização de solicitações',
          'a troca de mensagens',
          'o acompanhamento de determinados fluxos internos',
        ],
      },
      {
        type: 'paragraph',
        text: 'No entanto, cada usuário é responsável, naquilo que lhe couber, por:',
      },
      {
        type: 'list',
        items: [
          'veracidade das informações fornecidas',
          'negociações realizadas',
          'alinhamentos comerciais',
          'escopo, prazo e condições dos serviços',
          'entregas efetuadas',
          'condutas mantidas na relação entre as partes',
        ],
      },
      {
        type: 'paragraph',
        text: 'O Faço Freela não garante a contratação, a conclusão de negócios, a qualidade específica de qualquer serviço, a satisfação comercial entre usuários ou a obtenção de resultados particulares, salvo quando houver previsão expressa e específica em serviço próprio da plataforma.',
      },
    ],
  },
  {
    title: '8. Solicitações, propostas, mensagens e conteúdos',
    blocks: [
      {
        type: 'paragraph',
        text: 'A plataforma poderá permitir o envio de solicitações, propostas, descrições de serviços, mensagens, arquivos e outras interações entre usuários.',
      },
      {
        type: 'paragraph',
        text: 'Ao utilizar esses recursos, você declara que:',
      },
      {
        type: 'list',
        items: [
          'possui legitimidade para enviar o conteúdo',
          'não enviará material ilícito, enganoso ou ofensivo',
          'não utilizará a plataforma para assédio, fraude ou abuso',
          'responderá pela legalidade e veracidade do que compartilhar',
        ],
      },
      {
        type: 'paragraph',
        text: 'O Faço Freela poderá, conforme necessário:',
      },
      {
        type: 'list',
        items: [
          'remover conteúdos incompatíveis com estes Termos',
          'restringir mensagens ou interações abusivas',
          'registrar evidências para fins de segurança, auditoria, suporte e cumprimento legal',
          'suspender funcionalidades em caso de risco operacional ou jurídico',
        ],
      },
    ],
  },
  {
    title: '9. Disponibilidade da plataforma',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela busca manter sua plataforma em funcionamento com o melhor nível possível de estabilidade, segurança e desempenho.',
      },
      {
        type: 'paragraph',
        text: 'No entanto, a disponibilidade poderá ser afetada por:',
      },
      {
        type: 'list',
        items: [
          'manutenção programada',
          'correções técnicas',
          'atualizações',
          'falhas de infraestrutura',
          'incidentes de segurança',
          'indisponibilidades de terceiros',
          'eventos fora do controle razoável da plataforma',
        ],
      },
      {
        type: 'paragraph',
        text: 'Por isso, o Faço Freela não garante disponibilidade contínua, ininterrupta ou livre de erros, embora possa adotar medidas razoáveis para melhoria do serviço.',
      },
    ],
  },
  {
    title: '10. Modificações na plataforma',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela poderá, a qualquer momento e sem aviso prévio obrigatório, salvo quando a lei exigir o contrário:',
      },
      {
        type: 'list',
        items: [
          'alterar layout, design e identidade visual',
          'criar, modificar, suspender ou remover funcionalidades',
          'revisar critérios de acesso',
          'atualizar fluxos operacionais',
          'reorganizar estrutura de navegação',
          'aperfeiçoar recursos técnicos e de segurança',
        ],
      },
      {
        type: 'paragraph',
        text: 'Essas mudanças poderão ocorrer para melhorar a experiência, adequar o serviço à operação real da plataforma ou atender exigências técnicas, jurídicas e estratégicas.',
      },
    ],
  },
  {
    title: '11. Propriedade intelectual',
    blocks: [
      {
        type: 'paragraph',
        text: 'Salvo disposição em contrário, todos os direitos sobre os elementos da plataforma pertencem ao Faço Freela ou a seus respectivos titulares, incluindo, sem limitação:',
      },
      {
        type: 'list',
        items: [
          'nome da marca',
          'identidade visual',
          'logotipo',
          'layout',
          'textos institucionais',
          'interfaces',
          'elementos gráficos',
          'estrutura do site',
          'códigos, fluxos, sistemas e materiais próprios',
        ],
      },
      {
        type: 'paragraph',
        text: 'É proibido, sem autorização prévia e expressa:',
      },
      {
        type: 'list',
        items: [
          'copiar',
          'reproduzir',
          'distribuir',
          'modificar',
          'adaptar',
          'comercializar',
          'explorar economicamente',
          'utilizar indevidamente quaisquer desses elementos',
        ],
      },
      {
        type: 'paragraph',
        text: 'O uso indevido poderá ensejar responsabilização civil, administrativa e criminal, conforme aplicável.',
      },
    ],
  },
  {
    title: '12. Privacidade e proteção de dados',
    blocks: [
      {
        type: 'paragraph',
        text: 'O tratamento de dados pessoais realizado pelo Faço Freela ocorre nos termos da sua Política de Privacidade, que integra estes Termos de Uso para todos os fins.',
      },
      {
        type: 'paragraph',
        text: 'Ao utilizar a plataforma, o usuário reconhece que seus dados poderão ser tratados para viabilizar funcionalidades, segurança, suporte, operação da conta, comunicação e demais finalidades descritas na Política de Privacidade.',
      },
    ],
  },
  {
    title: '13. Suspensão, bloqueio e encerramento de conta',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela poderá suspender, restringir, bloquear ou encerrar contas, acessos ou funcionalidades, temporária ou definitivamente, quando houver indícios ou constatação de:',
      },
      {
        type: 'list',
        items: [
          'violação destes Termos',
          'uso indevido da plataforma',
          'fraude ou tentativa de fraude',
          'comportamento abusivo',
          'risco à segurança do sistema ou de terceiros',
          'fornecimento de informações falsas',
          'prática ilícita',
          'necessidade de cumprimento legal, regulatório ou judicial',
        ],
      },
      {
        type: 'paragraph',
        text: 'Sempre que viável e adequado ao caso, o Faço Freela poderá adotar medidas proporcionais à gravidade da situação.',
      },
      {
        type: 'paragraph',
        text: 'O usuário também poderá solicitar o encerramento de sua conta, observadas as condições técnicas, legais e operacionais aplicáveis, inclusive retenções necessárias para cumprimento legal, segurança e exercício regular de direitos.',
      },
    ],
  },
  {
    title: '14. Limitação de responsabilidade',
    blocks: [
      {
        type: 'paragraph',
        text: 'Na máxima extensão permitida pela legislação aplicável, o Faço Freela não se responsabiliza por:',
      },
      {
        type: 'list',
        items: [
          'condutas autônomas de usuários',
          'negociações realizadas entre clientes e freelancers',
          'informações falsas, imprecisas ou incompletas fornecidas por terceiros',
          'indisponibilidades temporárias do sistema',
          'falhas decorrentes de serviços de terceiros',
          'danos causados por culpa exclusiva do usuário ou de terceiros',
          'decisões comerciais tomadas com base em informações inseridas por outros usuários',
        ],
      },
      {
        type: 'paragraph',
        text: 'Nada nestes Termos deve ser interpretado como exclusão de responsabilidade em hipóteses que não possam ser legalmente afastadas.',
      },
    ],
  },
  {
    title: '15. Links e serviços de terceiros',
    blocks: [
      {
        type: 'paragraph',
        text: 'A plataforma poderá conter links, integrações ou referências a serviços de terceiros.',
      },
      {
        type: 'paragraph',
        text: 'Esses ambientes possuem regras e políticas próprias. O Faço Freela não é responsável por conteúdos, práticas, disponibilidade ou políticas de privacidade de terceiros fora de seu ambiente, salvo nos limites legalmente aplicáveis.',
      },
      {
        type: 'paragraph',
        text: 'Recomenda-se que o usuário leia os documentos próprios de cada serviço acessado.',
      },
    ],
  },
  {
    title: '16. Comunicações da plataforma',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela poderá enviar comunicações relacionadas ao uso da plataforma, inclusive:',
      },
      {
        type: 'list',
        items: [
          'avisos técnicos',
          'notificações de conta',
          'mensagens de suporte',
          'alertas de segurança',
          'atualizações relevantes',
          'comunicações operacionais',
        ],
      },
      {
        type: 'paragraph',
        text: 'Essas comunicações poderão ocorrer por e-mail, dentro da plataforma ou por outros meios compatíveis com a relação mantida com o usuário, respeitada a legislação aplicável.',
      },
    ],
  },
  {
    title: '17. Alterações destes Termos de Uso',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela poderá atualizar estes Termos de Uso a qualquer momento para refletir:',
      },
      {
        type: 'list',
        items: [
          'mudanças na plataforma',
          'novas funcionalidades',
          'ajustes operacionais',
          'adequações legais ou regulatórias',
          'melhorias de governança e segurança',
        ],
      },
      {
        type: 'paragraph',
        text: 'A versão atualizada será publicada no site com a respectiva data de atualização.',
      },
      {
        type: 'paragraph',
        text: 'O uso continuado da plataforma após a publicação de alterações poderá caracterizar aceitação da nova versão, ressalvados os direitos previstos em lei.',
      },
    ],
  },
  {
    title: '18. Contato institucional',
    blocks: [
      {
        type: 'paragraph',
        text: 'Para dúvidas, suporte ou comunicações relacionadas ao uso da plataforma, você pode entrar em contato pelos canais oficiais:',
      },
      { type: 'contacts' },
    ],
  },
  {
    title: '19. Lei aplicável e foro',
    blocks: [
      {
        type: 'paragraph',
        text: 'Estes Termos de Uso são regidos pela legislação da República Federativa do Brasil.',
      },
      {
        type: 'paragraph',
        text: 'Fica eleito o foro da comarca competente, conforme a legislação aplicável, para dirimir eventuais controvérsias relacionadas a estes Termos, ressalvadas as hipóteses de competência específica previstas em lei.',
      },
    ],
  },
];

const privacySections: InfoSection[] = [
  {
    title: '1. Quem somos',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela é uma plataforma digital voltada à organização da relação entre clientes e freelancers, com foco em clareza, praticidade e melhor acompanhamento das interações realizadas no ambiente do produto.',
      },
      {
        type: 'paragraph',
        text: 'Esta Política de Privacidade explica como tratamos dados pessoais vinculados ao uso do site, da plataforma, das funcionalidades, das páginas institucionais e dos canais oficiais do Faço Freela.',
      },
    ],
  },
  {
    title: '2. Quais dados coletamos',
    blocks: [
      {
        type: 'paragraph',
        text: 'Os dados tratados podem variar conforme o tipo de uso da plataforma, mas podem incluir:',
      },
      {
        type: 'list',
        items: [
          'dados de identificação, como nome, e-mail, telefone e informações básicas de conta',
          'dados de perfil, como cidade, estado, categoria profissional, apresentação e links informados pelo usuário',
          'dados de autenticação e sessão necessários para acesso seguro à conta',
          'dados de navegação, dispositivo, data, hora, logs técnicos e eventos de uso',
          'dados relacionados a mensagens, solicitações, interações e conteúdos enviados pela plataforma',
          'dados fornecidos em contato institucional, suporte ou canais oficiais da marca',
        ],
      },
    ],
  },
  {
    title: '3. Como coletamos os dados',
    blocks: [
      {
        type: 'paragraph',
        text: 'Os dados podem ser coletados diretamente quando você navega no site, cria conta, preenche formulários, atualiza perfil, envia mensagens, entra em contato com o suporte ou utiliza funcionalidades da plataforma.',
      },
      {
        type: 'paragraph',
        text: 'Também podem ser coletados automaticamente por meios técnicos, como registros de acesso, preferências de navegação, cookies e integrações necessárias ao funcionamento do produto.',
      },
    ],
  },
  {
    title: '4. Para que usamos os dados',
    blocks: [
      {
        type: 'paragraph',
        text: 'Os dados pessoais podem ser utilizados para:',
      },
      {
        type: 'list',
        items: [
          'viabilizar cadastro, autenticação e uso da conta',
          'operar perfis, buscas, conversas, solicitações e demais fluxos internos',
          'oferecer suporte, atendimento e comunicações institucionais',
          'proteger a segurança da plataforma, prevenir fraude e investigar comportamentos indevidos',
          'cumprir obrigações legais, regulatórias ou ordens de autoridades competentes',
          'melhorar desempenho, usabilidade, estabilidade e governança do produto',
        ],
      },
    ],
  },
  {
    title: '5. Bases legais',
    blocks: [
      {
        type: 'paragraph',
        text: 'O tratamento de dados pode ocorrer com base em hipóteses legais aplicáveis, como execução de contrato ou de procedimentos preliminares, cumprimento de obrigação legal, exercício regular de direitos, legítimo interesse e consentimento, quando exigido.',
      },
      {
        type: 'paragraph',
        text: 'A base legal utilizada pode variar conforme a finalidade específica do tratamento e o contexto da relação com o usuário.',
      },
    ],
  },
  {
    title: '6. Compartilhamento',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela poderá compartilhar dados com terceiros quando isso for necessário para operação do serviço, suporte técnico, hospedagem, autenticação, armazenamento, segurança, cumprimento legal ou proteção de direitos.',
      },
      {
        type: 'paragraph',
        text: 'Sempre que possível, o compartilhamento será limitado ao mínimo necessário para a finalidade envolvida.',
      },
    ],
  },
  {
    title: '7. Cookies',
    blocks: [
      {
        type: 'paragraph',
        text: 'O site e a plataforma podem utilizar cookies e tecnologias semelhantes para manter sessões, lembrar preferências, melhorar navegação, analisar desempenho e oferecer uma experiência mais estável.',
      },
      {
        type: 'paragraph',
        text: 'Você pode gerenciar cookies nas configurações do navegador, observando que a desativação de determinados recursos pode afetar o funcionamento de partes da plataforma.',
      },
    ],
  },
  {
    title: '8. Armazenamento',
    blocks: [
      {
        type: 'paragraph',
        text: 'Os dados poderão ser armazenados pelo tempo necessário para cumprir as finalidades descritas nesta Política, respeitar exigências legais, preservar segurança, registrar evidências operacionais e permitir o exercício regular de direitos.',
      },
      {
        type: 'paragraph',
        text: 'Quando o armazenamento deixar de ser necessário, os dados poderão ser excluídos, anonimizados ou mantidos apenas nas hipóteses legalmente permitidas.',
      },
    ],
  },
  {
    title: '9. Segurança',
    blocks: [
      {
        type: 'paragraph',
        text: 'O Faço Freela adota medidas técnicas e organizacionais razoáveis para reduzir riscos de acesso não autorizado, perda, alteração, divulgação indevida ou uso incompatível das informações tratadas na plataforma.',
      },
      {
        type: 'paragraph',
        text: 'Nenhum ambiente digital é totalmente imune a incidentes, mas buscamos continuamente aprimorar controles, autenticação, permissões e rotinas operacionais de proteção.',
      },
    ],
  },
  {
    title: '10. Direitos do titular',
    blocks: [
      {
        type: 'paragraph',
        text: 'Nos termos da legislação aplicável, o titular poderá solicitar, quando cabível:',
      },
      {
        type: 'list',
        items: [
          'confirmação da existência de tratamento',
          'acesso aos dados pessoais',
          'correção de dados incompletos, inexatos ou desatualizados',
          'anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos',
          'portabilidade, quando aplicável',
          'informação sobre compartilhamentos realizados',
          'revogação de consentimento, quando essa for a base legal adotada',
        ],
      },
    ],
  },
  {
    title: '11. Como exercer seus direitos',
    blocks: [
      {
        type: 'paragraph',
        text: 'Solicitações relacionadas a dados pessoais podem ser encaminhadas pelos canais institucionais do Faço Freela, especialmente pelo e-mail oficial de suporte.',
      },
      {
        type: 'paragraph',
        text: 'Para proteção da conta e da operação, poderemos solicitar informações complementares para validação de identidade antes de atender determinadas requisições.',
      },
    ],
  },
  {
    title: '12. Transferência internacional',
    blocks: [
      {
        type: 'paragraph',
        text: 'Alguns fornecedores, serviços de infraestrutura ou ferramentas integradas à plataforma podem envolver tratamento de dados fora do Brasil, sempre observadas medidas compatíveis com a legislação aplicável e com o nível de proteção exigido para a operação.',
      },
    ],
  },
  {
    title: '13. Dados de menores',
    blocks: [
      {
        type: 'paragraph',
        text: 'O uso da plataforma por menores de idade deve observar a legislação aplicável e, quando necessário, contar com supervisão ou representação por responsável legal.',
      },
      {
        type: 'paragraph',
        text: 'Se houver identificação de tratamento inadequado de dados de menores, medidas poderão ser adotadas para correção, restrição ou encerramento do acesso, conforme o caso.',
      },
    ],
  },
  {
    title: '14. Links de terceiros',
    blocks: [
      {
        type: 'paragraph',
        text: 'O site e a plataforma podem conter links para ambientes de terceiros. Esses serviços possuem políticas próprias e operam fora do ambiente do Faço Freela.',
      },
      {
        type: 'paragraph',
        text: 'Recomendamos que o usuário leia os documentos de privacidade e uso de cada serviço acessado fora da plataforma.',
      },
    ],
  },
  {
    title: '15. Alterações da política',
    blocks: [
      {
        type: 'paragraph',
        text: 'Esta Política de Privacidade poderá ser atualizada a qualquer momento para refletir mudanças na plataforma, ajustes operacionais, melhorias de segurança ou exigências legais e regulatórias.',
      },
      {
        type: 'paragraph',
        text: 'A versão vigente será publicada nesta página com a respectiva data de atualização.',
      },
    ],
  },
  {
    title: '16. Contato institucional',
    blocks: [
      {
        type: 'paragraph',
        text: 'Para dúvidas, solicitações relacionadas a dados pessoais, suporte ou comunicações institucionais, utilize os canais oficiais do Faço Freela:',
      },
      { type: 'contacts' },
    ],
  },
];

const content: Record<string, InfoPageContent> = {
  sobre: {
    title: 'Sobre a plataforma',
    intro:
      'O Faço Freela conecta clientes e profissionais autônomos com uma apresentação mais clara, institucional e fácil de usar.',
    blocks: [
      {
        type: 'paragraph',
        text: 'A plataforma foi criada para aproximar quem precisa contratar de quem trabalha por conta, em áreas como serviços locais, criativos, técnicos e digitais.',
      },
      {
        type: 'paragraph',
        text: 'Nossa proposta prioriza perfis públicos com boa leitura, busca objetiva, contato interno organizado e uma experiência que transmite mais confiança para os dois lados da relação.',
      },
    ],
    showOfficialReferences: true,
  },
  termos: {
    title: 'Termos de Uso',
    intro:
      'Estes Termos de Uso estabelecem as regras para acesso e utilização do site, da plataforma, dos recursos, funcionalidades, conteúdos e serviços disponibilizados pelo Faço Freela.',
    lastUpdated: legalLastUpdated,
    blocks: [
      { type: 'paragraph', text: 'Bem-vindo ao Faço Freela.' },
      {
        type: 'paragraph',
        text: 'Estes Termos de Uso estabelecem as regras para acesso e utilização do site, da plataforma, dos recursos, funcionalidades, conteúdos e serviços disponibilizados pelo Faço Freela.',
      },
      {
        type: 'paragraph',
        text: 'Ao acessar, navegar, se cadastrar ou utilizar a plataforma, você declara que leu, compreendeu e concorda com estes Termos de Uso, bem como com a Política de Privacidade do Faço Freela.',
      },
    ],
    sections: termsSections,
  },
  privacidade: {
    title: 'Política de Privacidade',
    intro:
      'Esta Política de Privacidade descreve como o Faço Freela coleta, utiliza, armazena, protege e compartilha dados pessoais relacionados ao uso do site, da plataforma e dos seus recursos institucionais e operacionais.',
    lastUpdated: legalLastUpdated,
    blocks: [
      {
        type: 'paragraph',
        text: 'Ao acessar, navegar, se cadastrar ou utilizar o Faço Freela, você reconhece esta Política como referência institucional para o tratamento de dados vinculado ao funcionamento da plataforma.',
      },
      {
        type: 'paragraph',
        text: 'A leitura desta página foi organizada para facilitar entendimento, transparência e consulta dos principais pontos de privacidade aplicáveis ao produto.',
      },
    ],
    sections: privacySections,
  },
  seguranca: {
    title: 'Segurança da plataforma',
    intro:
      'A operação do Faço Freela combina autenticação, controle de acesso e canais institucionais claros para reduzir fricção e aumentar a confiança do uso.',
    blocks: [
      {
        type: 'paragraph',
        text: 'Sessão, autenticação e regras de acesso são tratadas pela infraestrutura de autenticação da plataforma, incluindo validação de conta, restrições por perfil e separação entre informações públicas e privadas.',
      },
      {
        type: 'paragraph',
        text: 'Sempre que houver dúvida sobre acesso, comportamento da conta ou uso indevido, o contato institucional oficial deve ser usado como ponto de apoio da plataforma.',
      },
    ],
    supportCopy:
      'Em caso de dúvidas sobre acesso, segurança ou comportamento da conta, use o e-mail oficial',
    showOfficialReferences: true,
  },
  ajuda: {
    title: 'Ajuda e suporte',
    intro: 'Fale com o Faço Freela pelos canais oficiais da plataforma.',
    blocks: [
      {
        type: 'paragraph',
        text: 'Este é o ponto institucional para orientação, suporte operacional e dúvidas sobre o uso da plataforma.',
      },
      {
        type: 'paragraph',
        text: 'Se você precisar de apoio com acesso, conta, navegação, conversas ou comportamento geral do produto, use os canais oficiais abaixo.',
      },
    ],
    supportCopy:
      'Para suporte e dúvidas sobre a plataforma, entre em contato pelo e-mail oficial',
    showOfficialReferences: true,
  },
  contato: {
    title: 'Contato institucional',
    intro: 'Fale com os canais oficiais do Faço Freela.',
    blocks: [
      {
        type: 'paragraph',
        text: 'Os canais abaixo concentram o contato institucional da plataforma e a presença oficial da marca.',
      },
    ],
    showContactCards: true,
  },
};

function OfficialReferencesBlock() {
  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white/92 p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Canais oficiais da marca
      </p>
      <p className="mt-3 text-sm leading-7 text-slate-600">
        Para suporte institucional, escreva para{' '}
        <a
          className="font-semibold text-[#0071e3] transition hover:text-[#0077ed]"
          href={institutionalSupportMailto}
        >
          {institutionalEmail}
        </a>
        . A marca também mantém presença oficial no{' '}
        <a
          className="font-semibold text-slate-700 transition hover:text-slate-950"
          href={institutionalInstagramUrl}
          rel="noreferrer"
          target="_blank"
        >
          Instagram {institutionalInstagramHandle}
        </a>{' '}
        e no{' '}
        <a
          className="font-semibold text-slate-700 transition hover:text-slate-950"
          href={institutionalLinkedinUrl}
          rel="noreferrer"
          target="_blank"
        >
          LinkedIn {institutionalLinkedinLabel}
        </a>
        .
      </p>
    </section>
  );
}

function ContactCards() {
  return (
    <section className="grid gap-4 md:grid-cols-3">
      {institutionalChannels.map((channel) => {
        const externalProps =
          channel.id === 'email' ? {} : { rel: 'noreferrer', target: '_blank' as const };

        return (
          <a
            key={channel.id}
            className="group rounded-[30px] border border-slate-200/80 bg-white/94 p-6 shadow-[0_18px_42px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_22px_54px_rgba(15,23,42,0.08)]"
            href={channel.href}
            {...externalProps}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {channel.title}
            </p>
            <p className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">
              {channel.value}
            </p>
            <p className="mt-3 text-sm leading-7 text-slate-600">{channel.description}</p>
            <span className="mt-5 inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 transition group-hover:border-[#0071e3]/20 group-hover:bg-[#0071e3]/[0.06] group-hover:text-[#0071e3]">
              {channel.actionLabel}
            </span>
          </a>
        );
      })}
    </section>
  );
}

function ContactInstitutionalList() {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-slate-50/90 p-5">
      <div className="space-y-3 text-sm leading-7 text-slate-700">
        <p>
          E-mail institucional:{' '}
          <a className="font-semibold text-[#0071e3] transition hover:text-[#0077ed]" href={institutionalSupportMailto}>
            {institutionalEmail}
          </a>
        </p>
        <p>
          Instagram oficial:{' '}
          <a
            className="font-semibold text-[#0071e3] transition hover:text-[#0077ed]"
            href={institutionalInstagramUrl}
            rel="noreferrer"
            target="_blank"
          >
            {institutionalInstagramHandle}
          </a>
        </p>
        <p>
          LinkedIn oficial:{' '}
          <a
            className="font-semibold text-[#0071e3] transition hover:text-[#0077ed]"
            href={institutionalLinkedinUrl}
            rel="noreferrer"
            target="_blank"
          >
            {institutionalLinkedinUrl}
          </a>
        </p>
      </div>
    </div>
  );
}

function renderBlock(block: InfoBlock, key: string) {
  if (block.type === 'paragraph') {
    return (
      <p key={key} className="text-base leading-8 text-slate-600">
        {block.text}
      </p>
    );
  }

  if (block.type === 'list') {
    return (
      <ul key={key} className="space-y-3 pl-5 text-base leading-8 text-slate-600">
        {block.items.map((item) => (
          <li key={item} className="list-disc">
            {item}
          </li>
        ))}
      </ul>
    );
  }

  return <ContactInstitutionalList key={key} />;
}

export function InfoPage() {
  const { slug } = useParams();
  const page = slug ? content[slug] : undefined;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = page ? `${page.title} | Faço Freela` : 'Página não encontrada | Faço Freela';

    return () => {
      document.title = previousTitle;
    };
  }, [page]);

  if (!page) {
    return (
      <div className="container py-14">
        <div className="glass-panel rounded-[32px] p-8 shadow-soft">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">
            Página não encontrada
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            O conteúdo institucional solicitado não existe nesta versão.
          </p>
          <Link className="mt-6 inline-flex text-sm font-semibold text-brand-600" to="/">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-14">
      <article className="glass-panel mx-auto max-w-[78rem] overflow-hidden rounded-[36px] shadow-soft">
        <div className="border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(246,249,255,0.96)_100%)] p-8 lg:p-10">
          <div className="mx-auto max-w-4xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">
              Institucional
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950">
              {page.title}
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-600">{page.intro}</p>

            {page.lastUpdated ? (
              <div className="mt-6 inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-500">
                Última atualização: {page.lastUpdated}
              </div>
            ) : null}
          </div>
        </div>

        <div className="p-8 lg:p-10">
          <div className="mx-auto max-w-4xl space-y-8">
            {page.blocks?.length ? (
              <div className="space-y-5">
                {page.blocks.map((block, index) => renderBlock(block, `intro-${index}`))}
              </div>
            ) : null}

            {page.sections?.length ? (
              <div className="space-y-8">
                {page.sections.map((section, index) => (
                  <section
                    key={section.title}
                    className={index === 0 ? 'space-y-4' : 'space-y-4 border-t border-slate-200/80 pt-8'}
                  >
                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                      {section.title}
                    </h2>
                    <div className="space-y-4">
                      {section.blocks.map((block, blockIndex) =>
                        renderBlock(block, `${section.title}-${blockIndex}`),
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}

            {page.supportCopy ? (
              <section className="rounded-[30px] border border-[#0071e3]/12 bg-[#0071e3]/[0.05] p-6 shadow-[0_16px_40px_rgba(0,113,227,0.08)]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0071e3]">
                  Suporte oficial
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {page.supportCopy}{' '}
                  <a
                    className="font-semibold text-[#0071e3] transition hover:text-[#0077ed]"
                    href={institutionalSupportMailto}
                  >
                    {institutionalEmail}
                  </a>
                  .
                </p>
              </section>
            ) : null}

            {page.showContactCards ? <ContactCards /> : null}
            {page.showOfficialReferences ? <OfficialReferencesBlock /> : null}
          </div>
        </div>
      </article>
    </div>
  );
}
