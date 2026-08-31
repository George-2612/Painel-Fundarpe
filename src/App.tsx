import { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Search, RefreshCw, Calendar, Landmark, MapPin, Music2, FileSpreadsheet, DollarSign, X, Download, ChevronLeft, ChevronRight, Clock, CheckCircle2, Check, SlidersHorizontal } from 'lucide-react';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTR8hO5DKksGF2QwmnTF_djLiUW-k-fOVPy7egBENpz7XFe4VE9DUo19voruZv2jn9A4nkS6LwgCc-9/pub?gid=188948899&single=true&output=csv';

interface ItemBase {
  ANO: string;
  'Protocolo SEI': string;
  'Nome da Atração': string;
  Ciclo: string;
  'Nome do Evento': string;
  Municipio: string;
  Data: string;
  Credor: string;
  'CPF/CNPJ': string;
  'Qtd Integrantes': number | string;
  Duração: string;
  Valor: string | number;
  'Nº Empenho': string;
  Categoria: string;
  'Municipio de Origem': string;
  'Status Prestação de Contas': string;
  'Data Recebimento Prestação'?: string;
  'Data Envio GAF'?: string;
}

export default function App() {
  const [todosDados, setTodosDados] = useState<ItemBase[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [menuFiltrosAberto, setMenuFiltrosAberto] = useState(false);

  // Filtros (Sem Ciclo/Evento)
  const [anoSelecionado, setAnoSelecionado] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [muniFiltro, setMuniFiltro] = useState('Todos');
  const [statusPagoFiltro, setStatusPagoFiltro] = useState('Todos');

  // Paginação
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);

  // Normalizador universal de chaves da planilha
  const normalizarChave = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  };

  const extrairValorFlexivel = (item: Record<string, any>, chavesPossiveis: string[]): string => {
    const mapaNormalizado: Record<string, any> = {};
    for (const [k, v] of Object.entries(item)) {
      mapaNormalizado[normalizarChave(k)] = v;
    }

    for (const chave of chavesPossiveis) {
      const norm = normalizarChave(chave);
      if (mapaNormalizado[norm] !== undefined && mapaNormalizado[norm] !== null && String(mapaNormalizado[norm]).trim() !== '') {
        return String(mapaNormalizado[norm]).trim();
      }
    }
    return '';
  };

  const normalizarLinha = (raw: Record<string, any>): ItemBase => {
    const sei = extrairValorFlexivel(raw, ['Protocolo SEI', 'SEI', 'Protocolo', 'Numero SEI', 'N SEI']);
    const empenho = extrairValorFlexivel(raw, ['Nº Empenho', 'Empenho', 'Numero Empenho', 'NE', 'N Empenho']);
    const atraca = extrairValorFlexivel(raw, ['Nome da Atração', 'Atração', 'Atracao', 'Artista', 'Nome Atracao', 'Banda']);
    const credor = extrairValorFlexivel(raw, ['Credor', 'Nome Credor', 'Beneficiario', 'Proponente']);
    const municipio = extrairValorFlexivel(raw, ['Municipio', 'Município', 'Cidade', 'Municipio Evento']);
    const data = extrairValorFlexivel(raw, ['Data', 'Data Evento', 'Data Apresentação', 'Data da Apresentacao', 'Data Apresentacao']);
    const ciclo = extrairValorFlexivel(raw, ['Ciclo', 'Ciclo Evento', 'Tipo Evento', 'Evento']);
    const nomeEvento = extrairValorFlexivel(raw, ['Nome do Evento', 'Evento', 'Nome Evento', 'Ciclo']);
    const doc = extrairValorFlexivel(raw, ['CPF/CNPJ', 'CPF', 'CNPJ', 'Documento']);
    const valor = extrairValorFlexivel(raw, ['Valor', 'Valor Cache', 'Valor Cachê', 'Cache', 'Valor Total']);
    const status = extrairValorFlexivel(raw, ['Status Prestação de Contas', 'Status', 'Situacao', 'Situação', 'Status Pagamento', 'Pago']);
    const dataGaf = extrairValorFlexivel(raw, ['Data Envio GAF', 'Data GAF', 'Data Pagamento']);
    const dataPrestacao = extrairValorFlexivel(raw, ['Data Recebimento Prestação', 'Data Prestacao']);

    // Extrair Ano com múltiplas tentativas
    let ano = extrairValorFlexivel(raw, ['ANO', 'Ano', 'Exercicio', 'Exercício']);
    if (!ano || !/^\d{4}$/.test(ano)) {
      const matchSei = sei.match(/\/(\d{4})-/);
      if (matchSei) ano = matchSei[1];
    }
    if (!ano || !/^\d{4}$/.test(ano)) {
      const matchEmp = empenho.match(/^(\d{4})/);
      if (matchEmp) ano = matchEmp[1];
    }
    if (!ano || !/^\d{4}$/.test(ano)) {
      const matchData = data.match(/(\d{4})/);
      if (matchData) ano = matchData[1];
    }

    return {
      ANO: ano || '2024',
      'Protocolo SEI': sei,
      'Nome da Atração': atraca,
      Ciclo: ciclo,
      'Nome do Evento': nomeEvento,
      Municipio: municipio,
      Data: data,
      Credor: credor,
      'CPF/CNPJ': doc,
      'Qtd Integrantes': 1,
      Duração: '',
      Valor: valor,
      'Nº Empenho': empenho,
      Categoria: '',
      'Municipio de Origem': '',
      'Status Prestação de Contas': status,
      'Data Envio GAF': dataGaf,
      'Data Recebimento Prestação': dataPrestacao,
    };
  };

  const carregarDados = () => {
    setCarregando(true);
    Papa.parse(CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const dados = (results.data as Record<string, any>[])
          .map(normalizarLinha)
          .filter((item) => item['Nome da Atração'] || item.Credor || item['Protocolo SEI'] || item['Nº Empenho']);

        setTodosDados(dados);
        setCarregando(false);
      },
      error: () => {
        setTodosDados([]);
        setCarregando(false);
      },
    });
  };

  useEffect(() => {
    carregarDados();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [anoSelecionado, busca, muniFiltro, statusPagoFiltro]);

  const parseValor = (val: string | number | undefined): number => {
    if (!val) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const limpo = String(val).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
    const numero = parseFloat(limpo);
    return isNaN(numero) ? 0 : numero;
  };

  const converterParaObjetoData = (val: string | number | undefined): Date | null => {
    if (!val) return null;
    const valStr = String(val).trim();
    if (!valStr) return null;

    if (/^\d{5}$/.test(valStr)) {
      const serial = parseInt(valStr, 10);
      const utcDays = serial - 25569;
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      return new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
    }

    if (valStr.includes('/')) {
      const partes = valStr.split('/');
      if (partes.length === 3) {
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const ano = parseInt(partes[2], 10);
        if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
          return new Date(ano, mes, dia);
        }
      }
    }

    if (valStr.includes('-')) {
      const partes = valStr.split('-');
      if (partes.length === 3) {
        const ano = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const dia = parseInt(partes[2], 10);
        if (!isNaN(dia) && !isNaN(mes) && !isNaN(ano)) {
          return new Date(ano, mes, dia);
        }
      }
    }

    return null;
  };

  const formatarDataSheet = (val: string | number | undefined): string => {
    const dataObj = converterParaObjetoData(val);
    if (!dataObj) return String(val || 'N/A');

    const diaFmt = String(dataObj.getDate()).padStart(2, '0');
    const mesFmt = String(dataObj.getMonth() + 1).padStart(2, '0');
    const anoFmt = dataObj.getFullYear();

    return `${diaFmt}/${mesFmt}/${anoFmt}`;
  };

  const calcularDataPagamentoPrevista = (dataStr: string | number | undefined): string => {
    const dataEvento = converterParaObjetoData(dataStr);
    if (!dataEvento) return 'A definir';

    dataEvento.setDate(dataEvento.getDate() + 35);

    const diaFmt = String(dataEvento.getDate()).padStart(2, '0');
    const mesFmt = String(dataEvento.getMonth() + 1).padStart(2, '0');
    const anoFmt = dataEvento.getFullYear();

    return `${diaFmt}/${mesFmt}/${anoFmt}`;
  };

  const obterDataPagamentoRealizado = (item: ItemBase): string => {
    if (item['Data Envio GAF']) return formatarDataSheet(item['Data Envio GAF']);
    if (item['Data Recebimento Prestação']) return formatarDataSheet(item['Data Recebimento Prestação']);
    if (item.Data) return formatarDataSheet(item.Data);
    return 'Pago';
  };

  const limparFiltros = () => {
    setAnoSelecionado('Todos');
    setBusca('');
    setMuniFiltro('Todos');
    setStatusPagoFiltro('Todos');
  };

  const anosDisponiveis = useMemo(() => {
    const lista = todosDados.map((d) => String(d.ANO).trim()).filter((a) => a && a !== 'undefined' && a !== 'null');
    const unicos = Array.from(new Set(lista)).sort();
    return unicos.length > 0 ? ['Todos', ...unicos] : ['Todos', '2023', '2024', '2025', '2026'];
  }, [todosDados]);

  const municipios = useMemo(() => {
    const lista = todosDados.map((d) => d.Municipio).filter(Boolean);
    return ['Todos', ...Array.from(new Set(lista)).sort()];
  }, [todosDados]);

  const dadosFiltrados = useMemo(() => {
    return todosDados.filter((item) => {
      const bateAno = anoSelecionado === 'Todos' || String(item.ANO).trim() === anoSelecionado;
      const bateMuni = muniFiltro === 'Todos' || item.Municipio === muniFiltro;

      const isPago = String(item['Status Prestação de Contas'] || '').trim().toLowerCase().includes('pago');
      let bateStatus = true;
      if (statusPagoFiltro === 'SIM') bateStatus = isPago;
      if (statusPagoFiltro === 'NAO') bateStatus = !isPago;

      const termo = busca.toLowerCase();
      const bateBusca = !busca ||
        (item.Credor && item.Credor.toLowerCase().includes(termo)) ||
        (item['CPF/CNPJ'] && String(item['CPF/CNPJ']).toLowerCase().includes(termo)) ||
        (item['Nome da Atração'] && item['Nome da Atração'].toLowerCase().includes(termo)) ||
        (item['Protocolo SEI'] && item['Protocolo SEI'].toLowerCase().includes(termo)) ||
        (item['Nº Empenho'] && item['Nº Empenho'].toLowerCase().includes(termo)) ||
        (item.Municipio && item.Municipio.toLowerCase().includes(termo));

      return bateAno && bateMuni && bateStatus && bateBusca;
    });
  }, [todosDados, anoSelecionado, muniFiltro, statusPagoFiltro, busca]);

  const totalEfetivamentePago = useMemo(() => {
    return dadosFiltrados
      .filter((d) => String(d['Status Prestação de Contas']).trim().toLowerCase().includes('pago'))
      .reduce((acc, curr) => acc + parseValor(curr.Valor), 0);
  }, [dadosFiltrados]);

  const totalGeralEmpenhado = useMemo(() => {
    return dadosFiltrados.reduce((acc, curr) => acc + parseValor(curr.Valor), 0);
  }, [dadosFiltrados]);

  const totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina) || 1;
  const dadosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return dadosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [dadosFiltrados, paginaAtual, itensPorPagina]);

  const exportarCSV = () => {
    const dadosExportacao = dadosFiltrados.map((item) => {
      const isPago = String(item['Status Prestação de Contas'] || '').trim().toLowerCase().includes('pago');
      return {
        ...item,
        'Pago?': isPago ? 'Sim' : 'Não',
        'Data do Evento (Formatada)': formatarDataSheet(item.Data),
        'Data do Pagamento / Previsão (+35d)': isPago ? obterDataPagamentoRealizado(item) : calcularDataPagamentoPrevista(item.Data),
      };
    });
    const csv = Papa.unparse(dadosExportacao);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `fundarpe_transparencia_${anoSelecionado}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalMunicipiosAtendidos = useMemo(() => {
    const lista = dadosFiltrados.map((d) => d.Municipio).filter(Boolean);
    return new Set(lista).size;
  }, [dadosFiltrados]);

  const totalAtracoesDistintas = useMemo(() => {
    const lista = dadosFiltrados.map((d) => d['Nome da Atração']).filter(Boolean);
    return new Set(lista).size;
  }, [dadosFiltrados]);

  const temFiltroAtivo = busca || muniFiltro !== 'Todos' || anoSelecionado !== 'Todos' || statusPagoFiltro !== 'Todos';

  return (
    <div className="min-h-screen w-full bg-slate-100 text-slate-800 font-sans pb-12 overflow-x-hidden">
      
      {/* BARRA FIXA DE FILTROS */}
      <header className="sticky top-0 z-50 w-full bg-[#002F67] border-b-2 border-[#001a3a] shadow-md px-4 sm:px-6 py-3">
        <div className="w-full flex flex-col lg:flex-row items-center justify-between gap-3">
          
          <div className="w-full lg:w-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-[#001d42] text-white p-2 rounded-lg border border-[#00408a]">
                <Landmark className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h2 className="text-xs font-black tracking-wider text-white uppercase">FUNDARPE</h2>
                <p className="text-[10px] text-blue-200 font-medium">Governo do Estado de Pernambuco</p>
              </div>
            </div>

            <div className="flex items-center gap-2 lg:hidden">
              <button
                onClick={() => setMenuFiltrosAberto(!menuFiltrosAberto)}
                className="flex items-center gap-1.5 bg-[#001e42] border border-[#00408a] text-sky-300 font-bold px-3 py-1.5 rounded-lg text-xs"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filtros {temFiltroAtivo && <span className="w-2 h-2 rounded-full bg-amber-400" />}
              </button>

              <button
                onClick={carregarDados}
                className="bg-sky-500 text-[#002F67] font-bold p-1.5 rounded-lg"
                title="Sincronizar dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className={`${menuFiltrosAberto ? 'flex' : 'hidden lg:flex'} flex-col lg:flex-row flex-wrap items-stretch lg:items-center gap-2 w-full lg:w-auto flex-1 max-w-5xl justify-end`}>
            
            <div className="relative min-w-[180px] flex-1">
              <Search className="w-3.5 h-3.5 text-sky-300 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar atração, credor, SEI..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-[#001e42] border border-[#00408a] text-white pl-8 pr-3 py-1.5 rounded-lg text-xs font-medium placeholder-blue-200/60 focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-2 w-full lg:w-auto">
              
              <div className="flex items-center gap-1.5 bg-[#001e42] border border-[#00408a] px-3 py-1.5 rounded-lg">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <select
                  value={statusPagoFiltro}
                  onChange={(e) => setStatusPagoFiltro(e.target.value)}
                  className="bg-transparent text-white font-semibold text-xs focus:outline-none cursor-pointer w-full"
                >
                  <option value="Todos" className="bg-[#002F67]">Pago: Todos</option>
                  <option value="SIM" className="bg-[#002F67]">Pago: SIM</option>
                  <option value="NAO" className="bg-[#002F67]">Pago: NÃO</option>
                </select>
              </div>

              <select
                value={muniFiltro}
                onChange={(e) => setMuniFiltro(e.target.value)}
                className="bg-[#001e42] border border-[#00408a] text-white px-3 py-1.5 rounded-lg text-xs font-semibold focus:outline-none cursor-pointer truncate"
              >
                {municipios.map((m) => (
                  <option key={m} value={m} className="bg-[#002F67]">{m === 'Todos' ? 'Município: Todos' : m}</option>
                ))}
              </select>

              <div className="flex items-center gap-1.5 bg-[#001e42] border border-[#00408a] px-3 py-1.5 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <select
                  value={anoSelecionado}
                  onChange={(e) => setAnoSelecionado(e.target.value)}
                  className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer w-full"
                >
                  {anosDisponiveis.map((ano) => (
                    <option key={ano} value={ano} className="bg-[#002F67]">
                      {ano === 'Todos' ? 'Ano: Todos' : `Ano: ${ano}`}
                    </option>
                  ))}
                </select>
              </div>

            </div>

            <div className="flex items-center justify-end gap-2 mt-1 lg:mt-0">
              {temFiltroAtivo && (
                <button
                  onClick={limparFiltros}
                  className="flex-1 lg:flex-none flex items-center justify-center gap-1 text-xs text-rose-300 bg-rose-900/40 hover:bg-rose-900/60 border border-rose-700/50 px-2.5 py-1.5 rounded-lg font-semibold"
                >
                  <X className="w-3.5 h-3.5" /> Limpar
                </button>
              )}

              <button
                onClick={carregarDados}
                className="hidden lg:flex items-center bg-sky-500 hover:bg-sky-400 text-[#002F67] font-bold p-2 rounded-lg"
                title="Sincronizar dados"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
              </button>
            </div>

          </div>
        </div>
      </header>

      {/* PAINEL DE KPIS */}
      <main className="w-full px-4 sm:px-6 pt-4 sm:pt-6">
        
        <div className="w-full bg-[#002F67] text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-[#00214a] mb-4 sm:mb-6">
          <div className="mb-4 sm:mb-6">
            <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[9px] sm:text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              PAINEL DE TRANSPARÊNCIA E-FISCO PE
            </span>
            <h1 className="text-lg sm:text-2xl font-extrabold mt-2 text-white tracking-tight leading-snug">
              Painel de Pagamentos de Eventos e Apresentações Artísticas
            </h1>
            <p className="text-blue-100/80 text-[11px] sm:text-xs mt-1">
              Transparência pública sobre os pagamentos e estimativas de liquidação da FUNDARPE.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            
            <div className="bg-[#00214a]/90 border border-blue-900/80 p-3.5 sm:p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Apresentações</p>
                <h3 className="text-lg sm:text-2xl font-extrabold text-purple-400 mt-0.5 sm:mt-1">
                  {carregando ? '...' : dadosFiltrados.length.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="p-2 sm:p-2.5 bg-purple-500/10 text-purple-400 rounded-lg shrink-0"><FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            </div>

            <div className="bg-[#00214a]/90 border border-blue-900/80 p-3.5 sm:p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Artistas</p>
                <h3 className="text-lg sm:text-2xl font-extrabold text-sky-400 mt-0.5 sm:mt-1">
                  {carregando ? '...' : totalAtracoesDistintas.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="p-2 sm:p-2.5 bg-sky-500/10 text-sky-400 rounded-lg shrink-0"><Music2 className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            </div>

            <div className="bg-[#00214a]/90 border border-blue-900/80 p-3.5 sm:p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Municípios</p>
                <h3 className="text-lg sm:text-2xl font-extrabold text-amber-400 mt-0.5 sm:mt-1">
                  {carregando ? '...' : totalMunicipiosAtendidos}
                </h3>
              </div>
              <div className="p-2 sm:p-2.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0"><MapPin className="w-4 h-4 sm:w-5 sm:h-5" /></div>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-[#00214a]/90 border border-emerald-900/80 p-3.5 sm:p-4 rounded-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-300 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">
                    Total Pago Liquidado
                  </p>
                  <h3 className="text-base sm:text-xl font-extrabold text-emerald-400 mt-0.5 sm:mt-1">
                    {carregando ? '...' : `R$ ${totalEfetivamentePago.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </h3>
                </div>
                <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-400 rounded-lg shrink-0"><DollarSign className="w-4 h-4 sm:w-5 sm:h-5" /></div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-blue-900/80 flex items-center justify-between bg-blue-950/60 p-2 rounded-lg border border-blue-800/50">
                <span className="text-[9px] sm:text-[10px] text-blue-300 font-extrabold uppercase tracking-wide">
                  Valor Consulta (Total):
                </span>
                <span className="text-[11px] sm:text-xs font-black text-sky-300 font-mono">
                  {carregando ? '...' : `R$ ${totalGeralEmpenhado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* TABELA DE RESULTADOS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#002F67]">
                Relatório Detalhado de Apresentações e Pagamentos {anoSelecionado !== 'Todos' && `(${anoSelecionado})`}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Data real do pagamento exibida para processos pagos e previsão de +35 dias para os pendentes
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={exportarCSV}
                disabled={dadosFiltrados.length === 0}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <span className="text-xs font-bold text-[#002F67] bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-lg">
                {dadosFiltrados.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto w-full border border-slate-100 rounded-xl">
            {carregando ? (
              <div className="text-center py-12 text-slate-500 font-medium text-xs">Sincronizando planilha consolidada...</div>
            ) : dadosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-medium text-xs">Nenhum registro encontrado para os filtros selecionados.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse min-w-[800px]">
                <thead className="bg-[#002F67] text-white uppercase text-[10px] sm:text-[11px]">
                  <tr>
                    <th className="p-3 font-bold">ANO</th>
                    <th className="p-3 font-bold">SEI / Empenho</th>
                    <th className="p-3 font-bold min-w-[160px]">Atração</th>
                    <th className="p-3 font-bold min-w-[160px]">Credor</th>
                    <th className="p-3 font-bold">Município</th>
                    <th className="p-3 font-bold">Data Evento</th>
                    <th className="p-3 font-bold">Pago?</th>
                    <th className="p-3 font-bold min-w-[160px]">Data Pagamento / Previsão</th>
                    <th className="p-3 text-right font-bold whitespace-nowrap">Valor Cachê</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dadosPaginados.map((item, idx) => {
                    const statusLower = String(item['Status Prestação de Contas'] || '').trim().toLowerCase();
                    const isPago = statusLower.includes('pago');
                    const dataPrevista = calcularDataPagamentoPrevista(item.Data);
                    const dataPagamentoReal = obterDataPagamentoRealizado(item);
                    const dataEventoFormatada = formatarDataSheet(item.Data);

                    return (
                      <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-sky-50/80 transition-colors`}>
                        <td className="p-3 font-bold text-slate-500">{item.ANO}</td>
                        <td className="p-3 whitespace-nowrap">
                          <div className="font-mono text-sky-700 font-semibold">{item['Protocolo SEI']}</div>
                          <div className="font-mono text-[10px] text-slate-500">{item['Nº Empenho']}</div>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{item['Nome da Atração']}</td>
                        <td className="p-3 text-slate-600 max-w-[180px] truncate" title={item.Credor}>{item.Credor}</td>
                        <td className="p-3 font-semibold text-amber-700">{item.Municipio}</td>
                        <td className="p-3 font-medium whitespace-nowrap text-slate-700">{dataEventoFormatada}</td>
                        
                        {/* PAGO? */}
                        <td className="p-3 whitespace-nowrap">
                          {isPago ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              <Check className="w-3 h-3 text-emerald-600" /> SIM
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full text-[10px] font-bold">
                              NÃO
                            </span>
                          )}
                        </td>

                        {/* DATA PAGAMENTO / PREVISÃO */}
                        <td className="p-3 whitespace-nowrap font-medium">
                          {isPago ? (
                            <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md font-bold text-[11px] inline-flex items-center gap-1.5 shadow-sm">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              {dataPagamentoReal}
                            </span>
                          ) : (
                            <span className="text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-md font-bold text-[11px] inline-flex items-center gap-1.5 shadow-sm">
                              <Clock className="w-3.5 h-3.5 text-amber-600" />
                              {dataPrevista} (Previsão)
                            </span>
                          )}
                        </td>

                        <td className="p-3 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                          R$ {parseValor(item.Valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* BARRA DE PAGINAÇÃO */}
          {!carregando && dadosFiltrados.length > 0 && (
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="text-[11px] sm:text-xs">
                  {((paginaAtual - 1) * itensPorPagina) + 1} - {Math.min(paginaAtual * itensPorPagina, dadosFiltrados.length)} de {dadosFiltrados.length}
                </span>
                <select
                  value={itensPorPagina}
                  onChange={(e) => {
                    setItensPorPagina(Number(e.target.value));
                    setPaginaAtual(1);
                  }}
                  className="bg-slate-100 border border-slate-200 text-slate-700 rounded px-1.5 py-0.5 font-semibold focus:outline-none"
                >
                  <option value={10}>10/pg</option>
                  <option value={20}>20/pg</option>
                  <option value={50}>50/pg</option>
                  <option value={100}>100/pg</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPaginaAtual((prev) => Math.max(prev - 1, 1))}
                  disabled={paginaAtual === 1}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 text-slate-700" />
                </button>
                <span className="px-3 font-bold text-[#002F67]">Página {paginaAtual} de {totalPaginas}</span>
                <button
                  onClick={() => setPaginaAtual((prev) => Math.min(prev + 1, totalPaginas))}
                  disabled={paginaAtual === totalPaginas}
                  className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 text-slate-700" />
                </button>
              </div>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}