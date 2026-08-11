import { useState, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { Search, RefreshCw, Calendar, Landmark, MapPin, Music2, FileSpreadsheet, DollarSign, X } from 'lucide-react';

const BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRJpdaEW0-OqWzkmCtOK0aVpPl7V6-ZwPAY0wVeeM9ZmO2Z8xTB_vSUSjHgtPk0bE7hTR8comhnpdia/pub?single=true&output=csv&gid=';

const ABAS_CONFIG = [
  { ano: '2023', gid: '0' },
  { ano: '2024', gid: '725138225' },
  { ano: '2025', gid: '2003151629' },
  { ano: '2026', gid: '1866521137' },
];

interface ItemBase {
  ANO: number | string;
  'Protocolo SEI': string;
  'Nome da Atração': string;
  Ciclo: string;
  'Nome do Evento': string;
  Municipio: string;
  Data: string;
  Credor: string;
  'CPF/CNPJ': string;
  'Qtd Integrantes': number;
  Duração: string;
  Valor: string | number;
  'Nº Empenho': string;
  Categoria: string;
  'Municipio de Origem': string;
  'Status Prestação de Contas': string;
}

export default function App() {
  const [todosDados, setTodosDados] = useState<ItemBase[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Filtros
  const [anoSelecionado, setAnoSelecionado] = useState('Todos');
  const [busca, setBusca] = useState('');
  const [muniFiltro, setMuniFiltro] = useState('Todos');
  const [cicloFiltro, setCicloFiltro] = useState('Todos');

  const carregarTodasAsAbas = async () => {
    setCarregando(true);
    try {
      const promessas = ABAS_CONFIG.map((aba) => {
        return new Promise<ItemBase[]>((resolve) => {
          Papa.parse(`${BASE_URL}${aba.gid}`, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const dadosTratados = (results.data as ItemBase[]).map((item) => ({
                ...item,
                ANO: item.ANO || aba.ano,
              }));
              resolve(dadosTratados);
            },
            error: () => resolve([]),
          });
        });
      });

      const resultadosPorAba = await Promise.all(promessas);
      setTodosDados(resultadosPorAba.flat());
    } catch {
      setTodosDados([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarTodasAsAbas();
  }, []);

  // Conversor numérico seguro para lidar com formatação do Sheets
  const parseValor = (val: string | number | undefined): number => {
    if (!val) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const limpo = String(val).replace(/R\$\s?/g, '').replace(/\./g, '').replace(',', '.').trim();
    const numero = parseFloat(limpo);
    return isNaN(numero) ? 0 : numero;
  };

  const limparFiltros = () => {
    setAnoSelecionado('Todos');
    setBusca('');
    setMuniFiltro('Todos');
    setCicloFiltro('Todos');
  };

  const anosDisponiveis = useMemo(() => {
    const lista = todosDados.map((d) => String(d.ANO)).filter((a) => a && a !== 'undefined' && a !== 'null');
    return ['Todos', ...Array.from(new Set(lista)).sort()];
  }, [todosDados]);

  // Lista de Municípios dinâmica
  const municipios = useMemo(() => {
    const lista = todosDados.map((d) => d.Municipio).filter(Boolean);
    return ['Todos', ...Array.from(new Set(lista)).sort()];
  }, [todosDados]);

  // Lista de Ciclos/Eventos direta da planilha
  const ciclosPrincipais = useMemo(() => {
    const lista = todosDados.map((d) => (d.Ciclo || d['Nome do Evento'] || '').trim()).filter(Boolean);
    return ['Todos', ...Array.from(new Set(lista)).sort()];
  }, [todosDados]);

  // Aplicação Dinâmica de Filtros (Geral para todos os Anos ou Ano Específico)
  const dadosFiltrados = useMemo(() => {
    return todosDados.filter((item) => {
      // 1. Filtro por Ano
      const bateAno = anoSelecionado === 'Todos' || String(item.ANO) === anoSelecionado;

      // 2. Filtro por Município
      const bateMuni = muniFiltro === 'Todos' || item.Municipio === muniFiltro;

      // 3. Filtro por Ciclo / Evento
      const cicloItem = (item.Ciclo || item['Nome do Evento'] || '').trim();
      const bateCiclo = cicloFiltro === 'Todos' || cicloItem === cicloFiltro;

      // 4. Busca Geral
      const termo = busca.toLowerCase();
      const bateBusca = !busca ||
        (item.Credor && item.Credor.toLowerCase().includes(termo)) ||
        (item['CPF/CNPJ'] && String(item['CPF/CNPJ']).toLowerCase().includes(termo)) ||
        (item['Nome da Atração'] && item['Nome da Atração'].toLowerCase().includes(termo)) ||
        (item['Protocolo SEI'] && item['Protocolo SEI'].toLowerCase().includes(termo)) ||
        (item['Nº Empenho'] && item['Nº Empenho'].toLowerCase().includes(termo)) ||
        (item.Municipio && item.Municipio.toLowerCase().includes(termo));

      return bateAno && bateMuni && bateCiclo && bateBusca;
    });
  }, [todosDados, anoSelecionado, muniFiltro, cicloFiltro, busca]);

  // Soma Financeira do conjunto de dados filtrado atual
  const totalInvestido = useMemo(() => {
    return dadosFiltrados.reduce((acc, curr) => acc + parseValor(curr.Valor), 0);
  }, [dadosFiltrados]);

  const totalMunicipiosAtendidos = useMemo(() => {
    const lista = dadosFiltrados.map((d) => d.Municipio).filter(Boolean);
    return new Set(lista).size;
  }, [dadosFiltrados]);

  const totalAtracoesDistintas = useMemo(() => {
    const lista = dadosFiltrados.map((d) => d['Nome da Atração']).filter(Boolean);
    return new Set(lista).size;
  }, [dadosFiltrados]);

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-800 font-sans pb-12">
      
      {/* BARRA FIXA DE FILTROS */}
      <header className="sticky top-0 z-50 w-full bg-white border-b border-slate-200 shadow-sm px-6 py-3">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="bg-[#002F67] text-white p-2 rounded-lg">
              <Landmark className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-xs font-black tracking-wider text-[#002F67] uppercase">FUNDARPE</h2>
              <p className="text-[10px] text-slate-500 font-medium">Governo do Estado de Pernambuco</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-5xl justify-end">
            
            {/* BUSCA RÁPIDA */}
            <div className="relative min-w-[220px] flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar atração, credor, SEI..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full bg-slate-100 border border-slate-200 text-slate-800 pl-9 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#002F67]"
              />
            </div>

            {/* FILTRO DE MUNICÍPIO */}
            <select
              value={muniFiltro}
              onChange={(e) => setMuniFiltro(e.target.value)}
              className="bg-slate-100 border border-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#002F67] cursor-pointer"
            >
              {municipios.map((m) => (
                <option key={m} value={m}>{m === 'Todos' ? 'Município: Todos' : m}</option>
              ))}
            </select>

            {/* FILTRO DE CICLO / EVENTO */}
            <select
              value={cicloFiltro}
              onChange={(e) => setCicloFiltro(e.target.value)}
              className="bg-slate-100 border border-slate-200 text-slate-800 px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#002F67] cursor-pointer max-w-[260px] truncate"
            >
              {ciclosPrincipais.map((c) => (
                <option key={c} value={c}>{c === 'Todos' ? 'Evento/Ciclo: Todos' : c}</option>
              ))}
            </select>

            {/* FILTRO DE EXERCÍCIO / ANO */}
            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg">
              <Calendar className="w-3.5 h-3.5 text-[#002F67]" />
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(e.target.value)}
                className="bg-transparent text-slate-800 font-bold text-xs focus:outline-none cursor-pointer"
              >
                {anosDisponiveis.map((ano) => (
                  <option key={ano} value={ano}>
                    {ano === 'Todos' ? 'Ano: Todos' : `Ano: ${ano}`}
                  </option>
                ))}
              </select>
            </div>

            {/* BOTÃO LIMPAR */}
            {(busca || muniFiltro !== 'Todos' || cicloFiltro !== 'Todos' || anoSelecionado !== 'Todos') && (
              <button
                onClick={limparFiltros}
                className="flex items-center gap-1 text-xs text-rose-600 font-semibold hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" /> Limpar
              </button>
            )}

            <button
              onClick={carregarTodasAsAbas}
              className="bg-[#002F67] hover:bg-[#00214a] text-white p-2 rounded-lg transition-colors cursor-pointer"
              title="Sincronizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? 'animate-spin' : ''}`} />
            </button>

          </div>
        </div>
      </header>

      {/* BANNER PRINCIPAL COM KPIS */}
      <main className="w-full px-6 pt-6">
        
        <div className="w-full bg-[#002F67] text-white rounded-2xl p-6 shadow-xl border border-[#00214a] mb-6">
          <div className="mb-6">
            <span className="bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              PAINEL DE TRANSPARÊNCIA E-FISCO PE
            </span>
            <h1 className="text-xl md:text-2xl font-extrabold mt-2 text-white tracking-tight">
              Painel de Pagamentos de Eventos e Apresentações Artísticas
            </h1>
            <p className="text-blue-100/80 text-xs mt-1">
              Transparência sobre os pagamentos realizados para Eventos e Apresentações Artísticas apoiados pela FUNDARPE.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#00214a]/90 border border-blue-900/80 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Apresentações Encontradas</p>
                <h3 className="text-2xl font-extrabold text-purple-400 mt-1">
                  {carregando ? '...' : dadosFiltrados.length.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-lg"><FileSpreadsheet className="w-5 h-5" /></div>
            </div>

            <div className="bg-[#00214a]/90 border border-blue-900/80 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Artistas Diferentes</p>
                <h3 className="text-2xl font-extrabold text-sky-400 mt-1">
                  {carregando ? '...' : totalAtracoesDistintas.toLocaleString('pt-BR')}
                </h3>
              </div>
              <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-lg"><Music2 className="w-5 h-5" /></div>
            </div>

            <div className="bg-[#00214a]/90 border border-blue-900/80 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">Municípios Atendidos</p>
                <h3 className="text-2xl font-extrabold text-amber-400 mt-1">
                  {carregando ? '...' : totalMunicipiosAtendidos}
                </h3>
              </div>
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg"><MapPin className="w-5 h-5" /></div>
            </div>

            <div className="bg-[#00214a]/90 border border-blue-900/80 p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                  Total Pago ({anoSelecionado === 'Todos' ? 'Todos os Anos' : anoSelecionado})
                </p>
                <h3 className="text-xl font-extrabold text-emerald-400 mt-1">
                  {carregando ? '...' : `R$ ${totalInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </h3>
              </div>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><DollarSign className="w-5 h-5" /></div>
            </div>
          </div>
        </div>

        {/* TABELA DE RESULTADOS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-[#002F67]">
                Relatório Detalhado de Apresentações e Pagamentos {cicloFiltro !== 'Todos' && `— ${cicloFiltro}`} {anoSelecionado !== 'Todos' && `(${anoSelecionado})`}
              </h2>
              <p className="text-xs text-slate-500">Registros liquidados validados via SEFAZ / FUNDARPE</p>
            </div>
            <span className="text-xs font-bold text-[#002F67] bg-blue-50 border border-blue-200 px-3 py-1 rounded-full">
              {dadosFiltrados.length} registros encontrados
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            {carregando ? (
              <div className="text-center py-12 text-slate-500 font-medium text-xs">Sincronizando planilha...</div>
            ) : dadosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-slate-500 font-medium text-xs">Nenhum registro encontrado para os filtros selecionados.</div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#002F67] text-white uppercase text-[11px]">
                  <tr>
                    <th className="p-3 rounded-l-lg font-bold">ANO</th>
                    <th className="p-3 font-bold">Protocolo SEI</th>
                    <th className="p-3 font-bold">Nº Empenho</th>
                    <th className="p-3 font-bold">Atração</th>
                    <th className="p-3 font-bold">Ciclo / Evento</th>
                    <th className="p-3 font-bold">Credor</th>
                    <th className="p-3 font-bold">CPF/CNPJ</th>
                    <th className="p-3 font-bold">Município</th>
                    <th className="p-3 text-right rounded-r-lg font-bold">Valor Cachê</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {dadosFiltrados.slice(0, 50).map((item, idx) => (
                    <tr key={idx} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} hover:bg-sky-50/80 transition-colors`}>
                      <td className="p-3 font-bold text-slate-500">{item.ANO}</td>
                      <td className="p-3 font-mono text-sky-700 font-semibold whitespace-nowrap">{item['Protocolo SEI']}</td>
                      <td className="p-3 font-mono text-slate-600 font-semibold whitespace-nowrap">{item['Nº Empenho']}</td>
                      <td className="p-3 font-bold text-slate-900">{item['Nome da Atração']}</td>
                      <td className="p-3 font-medium text-slate-600">{item.Ciclo || item['Nome do Evento']}</td>
                      <td className="p-3 text-slate-600">{item.Credor}</td>
                      <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{item['CPF/CNPJ']}</td>
                      <td className="p-3 font-semibold text-amber-700">{item.Municipio}</td>
                      <td className="p-3 text-right font-extrabold text-emerald-600 whitespace-nowrap">
                        R$ {parseValor(item.Valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}