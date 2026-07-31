import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BarChart2,
  Calendar,
  ChevronLeft,
  ChevronLeft as LeftIcon,
  ChevronRight as RightIcon,
  Copy,
  Database,
  Edit3,
  FileText,
  Filter,
  Layout,
  Mail,
  PlusCircle,
  Printer,
  Save,
  Search,
  Trash2,
  TrendingUp,
  Wrench,
  X,
} from 'lucide-react';
import { supabase } from '../services/supabase-config';

const FILIAIS = ['CLIA', 'IPA', 'BK', 'HUB', 'FROTA'];
const COLUNAS_KANBAN = ['ATRASADOS', 'PROGRAMADO', 'EM ANDAMENTO', 'AGUARDANDO PE\u00c7A', 'FINALIZADO'];
const DIAS_SEMANA = ['S\u00c1B', 'DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX'];
const DIAS_GANTT = 21;
const LARGURA_DIA_GANTT = 160;
const BORDA_AUTO_SCROLL_GANTT = 90;
const PASSO_AUTO_SCROLL_GANTT = 32;
const DURACAO = ['CURTA', 'M\u00c9DIA', 'EXTENSA'];
const TIPOS_MANUTENCAO = ['CORRETIVA', 'CORRETIVA PROGRAMADA', 'PREVENTIVA', 'INSPE\u00c7\u00c3O E LUBRIFICA\u00c7\u00c3O', 'VERIFICAR N\u00cdVEIS', 'GERAL'];
const FALHAS = ['ALTERNADOR', 'ANTI BALAN\u00c7O', 'AR CONDICIONADO', 'ARLA', 'BANCO', 'BATERIA', 'BICO INJETOR', 'BOMBA', 'BUZINA', 'CABINE', 'C\u00c2MBIO', 'CARRETA', 'CILINDRO', 'COOLERS', 'CORRENTE', 'C\u00c2MERA', 'DESLOCADOR', 'DIFERENCIAL', 'DIRE\u00c7\u00c3O', 'EIXO DIRECIONAL', 'EL\u00c9TRICA', 'EMBREAGEM', 'EXTINTOR', 'FILTROS', 'FREIOS', 'HIDR\u00c1ULICO', 'ILUMINA\u00c7\u00c3O', 'INJETOR', 'JOYSTICK', 'LAN\u00c7A', 'LAVAGEM', 'LIMPADOR PARA-BRISA', 'MANGUEIRAS', 'MOTOR', 'PARA-LAMA', 'PARTIDA', 'PNEUM\u00c1TICO / BORRACHARIA', 'PREVENTIVA', 'PROJETOS', 'QUADRO', 'RADIADOR', 'REFORMA / SOLDA', 'RODA', 'SPREADER', 'SUSPENS\u00c3O', 'TORRE', 'TRANSMISS\u00c3O', 'TURBINA', 'VAZAMENTO', '\u00d3LEO', 'ALINHAMENTO'];
const PRIORIDADES = ['BAIXA', 'M\u00c9DIA', 'ALTA', 'CR\u00cdTICA'];
const OPCOES_SIM_NAO = ['N\u00c3O', 'SIM'];
const CAMPOS_DATA = ['data_parada', 'prazo', 'data_final'];
const EMAIL_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_EMAIL_URL || 'https://script.google.com/a/macros/band-deicmar.com.br/s/AKfycby0udmNkKYwp_OvooNC6vN979kLB6bBz7LTPZHBgpOLcOdVBbcfaPtFS8lO-q7Zn2n47g/exec';

const dataListId = (campo) => `programacao-${campo}`;

const normalizarTexto = (valor) => (valor || '').toString().trim().toUpperCase();

const parseDate = (valor) => {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
};

const inicioSemanaSabado = (referencia = new Date()) => {
  const d = new Date(referencia);
  const day = d.getDay();
  const diff = day === 6 ? 0 : day + 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatDtInput = (valor) => {
  const data = parseDate(valor);
  if (!data) return '';
  const offset = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - offset).toISOString().slice(0, 16);
};

const toIsoOrNull = (valor) => {
  const data = parseDate(valor);
  return data ? data.toISOString() : null;
};

const formatarDataHoraBR = (valor) => {
  const data = parseDate(valor);
  if (!data) return '-';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).replace(',', '');
};

const mesmaDataBase = (a, b) => {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da && !db) return true;
  if (!da || !db) return false;
  return da.getTime() === db.getTime();
};

const checarSeAtrasado = (item) => {
  if (!item || item.situacao === 'FINALIZADO') return false;
  const prazo = parseDate(item.prazo || item.data_final || item.data_parada);
  if (!prazo) return false;
  return prazo.getTime() < Date.now();
};

const situacaoVisual = (item) => (checarSeAtrasado(item) ? 'ATRASADOS' : item.situacao || 'PROGRAMADO');

const normalizarSituacaoPorDatas = (item) => {
  if (parseDate(item?.data_final)) return { ...item, situacao: 'FINALIZADO' };
  if (checarSeAtrasado(item)) return { ...item, situacao: 'ATRASADOS' };
  return item;
};

const buildLinhaVazia = () => ({
  id: null,
  placa: '',
  os: '',
  filial: 'CLIA',
  reprogramado: 'N\u00c3O',
  prioridade: 'M\u00c9DIA',
  data_parada: new Date().toISOString(),
  duracao: 'CURTA',
  tipo: 'PREVENTIVA',
  responsavel: '',
  falha: 'MOTOR',
  prazo: '',
  data_final: '',
  observacoes: '',
  situacao: 'PROGRAMADO',
});

const DatalistInput = ({ campo, value, options, onChange, className, placeholder = '' }) => (
  <>
    <input
      list={dataListId(campo)}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
    <datalist id={dataListId(campo)}>
      {options.map((opcao) => <option key={opcao} value={opcao} />)}
    </datalist>
  </>
);

const Programacao = () => {
  const navigate = useNavigate();
  const ganttScrollRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState([]);
  const [equipamentos, setEquipamentos] = useState([]);
  const [abaAtiva, setAbaAtiva] = useState('dashboard');
  const [filiaisSelecionadas, setFiliaisSelecionadas] = useState(['TODAS']);
  const [colunaAberta, setColunaAberta] = useState('EM ANDAMENTO');
  const [ordenacao, setOrdenacao] = useState('data');
  const [buscaEditor, setBuscaEditor] = useState('');
  const [filiaisEditor, setFiliaisEditor] = useState(['TODAS']);
  const [ordenacaoEditor, setOrdenacaoEditor] = useState('recente');
  const [dataBaseGantt, setDataBaseGantt] = useState(() => inicioSemanaSabado());
  const [modalExportarAberto, setModalExportarAberto] = useState(false);
  const [modalPlanilhaAberto, setModalPlanilhaAberto] = useState(false);
  const [modalNovaManutencaoAberto, setModalNovaManutencaoAberto] = useState(false);
  const [novaManutencao, setNovaManutencao] = useState(() => buildLinhaVazia());
  const [salvandoNovaManutencao, setSalvandoNovaManutencao] = useState(false);
  const [destinatariosEmail, setDestinatariosEmail] = useState('');
  const [linhasPlanilha, setLinhasPlanilha] = useState([]);
  const [salvandoTudo, setSalvandoTudo] = useState(false);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const diasDaSemana = useMemo(() => Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(dataBaseGantt);
    d.setDate(dataBaseGantt.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  }), [dataBaseGantt]);

  const diasGantt = useMemo(() => Array.from({ length: DIAS_GANTT }).map((_, i) => {
  const d = new Date(dataBaseGantt);
  d.setDate(dataBaseGantt.getDate() + i);
  d.setHours(0, 0, 0, 0);
  return d;
}), [dataBaseGantt]);

  const opcoesPlaca = useMemo(() => {
    const placasDados = dados.map((item) => item.placa).filter(Boolean);
    return [...new Set([...equipamentos, ...placasDados].map(normalizarTexto).filter(Boolean))].sort();
  }, [dados, equipamentos]);

  const atualizarSituacoesAutomaticasNoBanco = async (registros) => {
    const desatualizados = registros
      .map((item) => ({ item, normalizado: normalizarSituacaoPorDatas(item) }))
      .filter(({ item, normalizado }) => item.situacao !== normalizado.situacao);
    if (!desatualizados.length) return;
    await Promise.all(desatualizados.map(({ item, normalizado }) => (
      supabase.from('programacao').update({ situacao: normalizado.situacao }).eq('id', item.id)
    )));
  };

  const fetchProgramacao = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('programacao').select('*').order('data_parada', { ascending: true });
    if (!error) {
      const registros = data || [];
      const normalizados = registros.map(normalizarSituacaoPorDatas);
      setDados(normalizados);
      setLinhasPlanilha(normalizados);
      atualizarSituacoesAutomaticasNoBanco(registros);
    } else {
      alert(`Erro ao carregar programacao: ${error.message}`);
    }
    setLoading(false);
  };

  const fetchEquipamentos = async () => {
    const { data, error } = await supabase.from('equipamentos').select('id').order('id', { ascending: true });
    if (!error) setEquipamentos((data || []).map((item) => item.id).filter(Boolean));
  };

  useEffect(() => {
    fetchProgramacao();
    fetchEquipamentos();
  }, []);

  const toggleSelecao = (valor, selecionados, setSelecionados) => {
    if (valor === 'TODAS') {
      setSelecionados(['TODAS']);
      return;
    }
    setSelecionados((prev) => {
      const filtrado = prev.filter((item) => item !== 'TODAS');
      if (filtrado.includes(valor)) {
        const novo = filtrado.filter((item) => item !== valor);
        return novo.length ? novo : ['TODAS'];
      }
      return [...filtrado, valor];
    });
  };

  const dadosFiltradosGerais = useMemo(() => dados
    .filter((item) => filiaisSelecionadas.includes('TODAS') || filiaisSelecionadas.includes(item.filial))
    .sort((a, b) => {
      const aAtrasado = checarSeAtrasado(a);
      const bAtrasado = checarSeAtrasado(b);
      if (aAtrasado && !bAtrasado) return -1;
      if (!aAtrasado && bAtrasado) return 1;
      if (ordenacao === 'prioridade') {
        const peso = { 'CR\u00cdTICA': 4, ALTA: 3, 'M\u00c9DIA': 2, BAIXA: 1 };
        return (peso[normalizarTexto(b.prioridade)] || 0) - (peso[normalizarTexto(a.prioridade)] || 0);
      }
      return (parseDate(a.data_parada)?.getTime() || 0) - (parseDate(b.data_parada)?.getTime() || 0);
    }), [dados, filiaisSelecionadas, ordenacao]);

  const totalGeral = dadosFiltradosGerais.length;
  const cAtrasados = dadosFiltradosGerais.filter(checarSeAtrasado).length;
  const cAndamento = dadosFiltradosGerais.filter((i) => i.situacao === 'EM ANDAMENTO' && !checarSeAtrasado(i)).length;
  const cAguardando = dadosFiltradosGerais.filter((i) => i.situacao === 'AGUARDANDO PE\u00c7A').length;
  const cFinalizados = dadosFiltradosGerais.filter((i) => i.situacao === 'FINALIZADO').length;
  const cProgramados = dadosFiltradosGerais.filter((i) => i.situacao === 'PROGRAMADO' && !checarSeAtrasado(i)).length;

  const itensDaSemana = useMemo(() => dadosFiltradosGerais.filter((item) => {
    const inicio = parseDate(item.data_parada);
    if (!inicio) return false;
    const fim = parseDate(item.data_final || item.prazo || item.data_parada) || inicio;
    const inicioSemana = new Date(diasDaSemana[0]).setHours(0, 0, 0, 0);
    const fimSemana = new Date(diasDaSemana[6]).setHours(23, 59, 59, 999);
    return inicio.getTime() <= fimSemana && fim.getTime() >= inicioSemana;
  }), [dadosFiltradosGerais, diasDaSemana]);

  const itensGantt = useMemo(() => dadosFiltradosGerais.filter((item) => {
  const inicio = parseDate(item.data_parada);
  if (!inicio) return false;
  const fim = parseDate(item.data_final || item.prazo || item.data_parada) || inicio;
  const inicioPeriodo = new Date(diasGantt[0]).setHours(0, 0, 0, 0);
  const fimPeriodo = new Date(diasGantt[diasGantt.length - 1]).setHours(23, 59, 59, 999);
  return inicio.getTime() <= fimPeriodo && fim.getTime() >= inicioPeriodo;
}), [dadosFiltradosGerais, diasGantt]);

  const linhasEditorFiltradas = useMemo(() => linhasPlanilha
    .filter((item) => {
      const busca = buscaEditor.toLowerCase();
      const bateTexto = [item.placa, item.os, item.responsavel, item.observacoes].some((valor) => (valor || '').toLowerCase().includes(busca));
      const bateFilial = filiaisEditor.includes('TODAS') || filiaisEditor.includes(item.filial);
      return bateTexto && bateFilial;
    })
    .sort((a, b) => {
      if (!a.id && b.id) return -1;
      if (a.id && !b.id) return 1;
      if (ordenacaoEditor === 'placa') return (a.placa || '').localeCompare(b.placa || '');
      if (ordenacaoEditor === 'prioridade') {
        const peso = { 'CR\u00cdTICA': 4, ALTA: 3, 'M\u00c9DIA': 2, BAIXA: 1 };
        return (peso[normalizarTexto(b.prioridade)] || 0) - (peso[normalizarTexto(a.prioridade)] || 0);
      }
      return (parseDate(b.created_at)?.getTime() || 0) - (parseDate(a.created_at)?.getTime() || 0);
    }), [linhasPlanilha, buscaEditor, filiaisEditor, ordenacaoEditor]);

  const prevWeek = () => setDataBaseGantt((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
  const nextWeek = () => setDataBaseGantt((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
  const resetWeek = () => setDataBaseGantt(inicioSemanaSabado());

  const abrirModalPlanilha = () => {
    setBuscaEditor('');
    setLinhasPlanilha(dados);
    setModalPlanilhaAberto(true);
  };

  const abrirModalPlanilhaComItem = (item) => {
  setBuscaEditor(item?.placa || item?.os || '');
  setLinhasPlanilha(dados);
  setModalPlanilhaAberto(true);
  };
  
  const abrirModalNovaManutencao = (diaSelecionado = null) => {
  const linha = buildLinhaVazia();

  if (diaSelecionado) {
    const data = new Date(diaSelecionado);
    data.setHours(8, 0, 0, 0);
    linha.data_parada = data.toISOString();
    linha.prazo = data.toISOString();
  }

  setNovaManutencao(linha);
  setModalNovaManutencaoAberto(true);
};
  
  const adicionarNovaLinha = () => setLinhasPlanilha((prev) => [buildLinhaVazia(), ...prev]);

  const duplicarLinha = (linhaRef) => {
    const index = linhasPlanilha.findIndex((linha) => linha === linhaRef);
    if (index === -1) return;
    const novasLinhas = [...linhasPlanilha];
    novasLinhas.splice(index + 1, 0, { ...linhaRef, id: null, os: '', reprogramado: linhaRef.reprogramado || 'N\u00c3O' });
    setLinhasPlanilha(novasLinhas);
  };

  const atualizarLinha = (linhaRef, campo, valor) => {
    setLinhasPlanilha((prev) => prev.map((linha) => {
      if (linha !== linhaRef) return linha;
      const novaLinha = { ...linha, [campo]: campo === 'placa' ? normalizarTexto(valor) : valor };
      if (CAMPOS_DATA.includes(campo) && linha.id && !mesmaDataBase(linha[campo], valor)) {
        novaLinha.reprogramado = 'SIM';
      }
      if (campo === 'data_final') {
        novaLinha.situacao = parseDate(valor) ? 'FINALIZADO' : (linha.situacao === 'FINALIZADO' ? 'PROGRAMADO' : linha.situacao);
      }
      return novaLinha;
    }));
  };

  const atualizarNovaManutencao = (campo, valor) => {
    setNovaManutencao((prev) => {
      const novaLinha = { ...prev, [campo]: campo === 'placa' ? normalizarTexto(valor) : valor };
      if (campo === 'data_final') {
        novaLinha.situacao = parseDate(valor) ? 'FINALIZADO' : (prev.situacao === 'FINALIZADO' ? 'PROGRAMADO' : prev.situacao);
      }
      return novaLinha;
    });
  };

  const montarPayload = (linha) => {
    const payload = {
      ...linha,
      placa: normalizarTexto(linha.placa),
      filial: normalizarTexto(linha.filial || 'CLIA'),
      prioridade: normalizarTexto(linha.prioridade || 'M\u00c9DIA'),
      tipo: normalizarTexto(linha.tipo || 'PREVENTIVA'),
      falha: normalizarTexto(linha.falha || 'MOTOR'),
      duracao: normalizarTexto(linha.duracao || 'CURTA'),
      reprogramado: normalizarTexto(linha.reprogramado || 'N\u00c3O'),
      situacao: normalizarTexto(linha.situacao || 'PROGRAMADO'),
      data_parada: toIsoOrNull(linha.data_parada),
      prazo: toIsoOrNull(linha.prazo),
      data_final: toIsoOrNull(linha.data_final),
    };
    return normalizarSituacaoPorDatas(payload);
  };

  const salvarLinha = async (linhaRef, silencioso = false) => {
    const payload = montarPayload(linhaRef);
    if (!payload.placa) {
      if (!silencioso) alert('Informe a Placa / Tag antes de salvar.');
      return { error: { message: 'Placa / Tag obrigatoria' } };
    }

    if (payload.id) {
      const { error } = await supabase.from('programacao').update(payload).eq('id', payload.id);
      if (!silencioso) alert(error ? `Erro ao salvar: ${error.message}` : 'Registro salvo com sucesso!');
      return { error };
    }

    delete payload.id;
    const { data, error } = await supabase.from('programacao').insert([payload]).select();
    if (!error && data?.[0]) {
      setLinhasPlanilha((prev) => prev.map((linha) => (linha === linhaRef ? data[0] : linha)));
    }
    if (!silencioso) alert(error ? `Erro ao salvar: ${error.message}` : 'Registro salvo com sucesso!');
    return { error };
  };

  const salvarNovaManutencao = async () => {
  const payload = montarPayload(novaManutencao);
  if (!payload.placa) {
    alert('Informe a Placa / Tag antes de salvar.');
    return;
  }

  setSalvandoNovaManutencao(true);
  const { id, created_at, ...dadosInsert } = payload;
  const { error } = await supabase.from('programacao').insert([dadosInsert]);
  setSalvandoNovaManutencao(false);

  if (error) {
    alert(`Erro ao criar manutencao: ${error.message}`);
    return;
  }

  setModalNovaManutencaoAberto(false);
  setNovaManutencao(buildLinhaVazia());
  await fetchProgramacao();
  alert('Manutencao criada com sucesso!');
};

  
  const salvarTudo = async () => {
    setSalvandoTudo(true);
    const linhas = [...linhasPlanilha];
    let falhas = 0;
    for (const linha of linhas) {
      const { error } = await salvarLinha(linha, true);
      if (error) falhas += 1;
    }
    await fetchProgramacao();
    setSalvandoTudo(false);
    alert(falhas ? `Salvamento geral concluido com ${falhas} falha(s).` : 'Todas as linhas foram salvas com sucesso!');
  };

  const handleExcluir = async (linhaRef) => {
    if (!window.confirm('Deseja excluir este item permanentemente?')) return;
    if (!linhaRef.id) {
      setLinhasPlanilha((prev) => prev.filter((linha) => linha !== linhaRef));
      return;
    }
    const { error } = await supabase.from('programacao').delete().eq('id', linhaRef.id);
    if (!error) {
      setLinhasPlanilha((prev) => prev.filter((linha) => linha !== linhaRef));
      fetchProgramacao();
    } else {
      alert(`Erro ao excluir: ${error.message}`);
    }
  };

  const onDragStartKanban = (e, item) => {
    e.dataTransfer.setData('programacao-id', item.id);
  };

  const onDropKanban = async (e, novaSituacao) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('programacao-id');
    const item = dados.find((registro) => String(registro.id) === String(id));
    if (!item) return;

    const payload = { situacao: novaSituacao };
    if (novaSituacao === 'FINALIZADO' && !item.data_final) {
      const valor = window.prompt('Informe a data e hora de fim (AAAA-MM-DD HH:mm):', formatDtInput(new Date()).replace('T', ' '));
      if (!valor) return;
      payload.data_final = toIsoOrNull(valor.replace(' ', 'T'));
    }
    const { error } = await supabase.from('programacao').update(payload).eq('id', id);
    if (!error) fetchProgramacao();
    else alert(`Erro ao mover card: ${error.message}`);
  };

  const deslocarData = (valor, diffMs) => {
    const data = parseDate(valor);
    return data ? new Date(data.getTime() + diffMs).toISOString() : valor;
  };

  const onDragStartGantt = (e, item) => {
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('gantt-id', item.id);
};

const handleDragOverGantt = (e) => {
  e.preventDefault();
  const container = ganttScrollRef.current;
  if (!container) return;

  const { left, right } = container.getBoundingClientRect();
  if (e.clientX > right - BORDA_AUTO_SCROLL_GANTT) {
    container.scrollLeft += PASSO_AUTO_SCROLL_GANTT;
  } else if (e.clientX < left + BORDA_AUTO_SCROLL_GANTT) {
    container.scrollLeft -= PASSO_AUTO_SCROLL_GANTT;
  }
};

  const onDropGantt = async (e, diaDestino) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('gantt-id');
    const item = dados.find((registro) => String(registro.id) === String(id));
    if (!item) return;
    const horaAtual = formatDtInput(item.data_parada).slice(11, 16) || '08:00';
    const hora = window.prompt(`Confirmar horario para ${diaDestino.toLocaleDateString('pt-BR')}:`, horaAtual);
    if (!hora) return;

    const dataOriginal = parseDate(item.data_parada);
    const novaData = new Date(diaDestino);
    const [hh, mm] = hora.split(':');
    novaData.setHours(Number(hh || 0), Number(mm || 0), 0, 0);
    const diffMs = dataOriginal ? novaData.getTime() - dataOriginal.getTime() : 0;
    const payload = {
      data_parada: novaData.toISOString(),
      prazo: deslocarData(item.prazo, diffMs),
      data_final: item.data_final ? deslocarData(item.data_final, diffMs) : item.data_final,
      reprogramado: 'SIM',
      situacao: item.data_final || item.situacao === 'FINALIZADO' ? 'FINALIZADO' : 'PROGRAMADO',
    };
    const { error } = await supabase.from('programacao').update(payload).eq('id', id);
    if (!error) fetchProgramacao();
    else alert(`Erro ao reprogramar: ${error.message}`);
  };

  const gerarRelatorioPDF = () => {
    const doc = new jsPDF('landscape');
    const dataInicio = diasDaSemana[0]?.toLocaleDateString('pt-BR');
    const dataFim = diasDaSemana[6]?.toLocaleDateString('pt-BR');
    const pageWidth = doc.internal.pageSize.getWidth();
    const statusColor = (item) => {
      if (checarSeAtrasado(item)) return [220, 38, 38];
      if (item.reprogramado === 'SIM') return [245, 158, 11];
      if (item.situacao === 'FINALIZADO') return [16, 185, 129];
      if (item.situacao === 'EM ANDAMENTO') return [15, 76, 129];
      if (item.situacao === 'AGUARDANDO PE\u00c7A') return [124, 58, 237];
      return [20, 116, 173];
    };

    doc.setFillColor(15, 76, 129);
    doc.rect(0, 0, pageWidth, 28, 'F');
    doc.setFillColor(16, 185, 129);
    doc.rect(pageWidth - 72, 0, 72, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(21);
    doc.setFont(undefined, 'bold');
    doc.text('Plano de Manutencao Semanal', 14, 17);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.text(`Periodo: ${dataInicio} a ${dataFim}`, 14, 24);
    doc.text(`Filiais: ${filiaisSelecionadas.join(', ')}`, pageWidth - 70, 17);

    const resumo = [
      ['Total', totalGeral, [15, 76, 129]],
      ['Atrasados', cAtrasados, [220, 38, 38]],
      ['Programados', cProgramados, [20, 116, 173]],
      ['Andamento', cAndamento, [245, 158, 11]],
      ['Finalizados', cFinalizados, [16, 185, 129]],
    ];
    resumo.forEach(([label, valor, color], idx) => {
      const x = 14 + (idx * 39);
      doc.setFillColor(...color);
      doc.roundedRect(x, 34, 33, 12, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text(label, x + 3, 39);
      doc.setFontSize(12);
      doc.text(String(valor), x + 3, 44);
    });

    doc.setTextColor(15, 76, 129);
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Calendario semanal', 14, 55);

    autoTable(doc, {
      startY: 59,
      head: [DIAS_SEMANA.map((dia, idx) => `${dia}\n${diasDaSemana[idx].getDate()}/${String(diasDaSemana[idx].getMonth() + 1).padStart(2, '0')}`)],
      body: itensDaSemana.map((item) => diasDaSemana.map((dia) => {
        const inicio = parseDate(item.data_parada);
        const fim = parseDate(item.data_final || item.prazo || item.data_parada) || inicio;
        return inicio && inicio.setHours(0, 0, 0, 0) <= dia.getTime() && fim.setHours(0, 0, 0, 0) >= dia.getTime()
          ? `${item.placa || '-'} ${item.os ? `OS ${item.os}` : ''}\nFalha: ${item.falha || '-'}`
          : '';
      })),
      theme: 'grid',
      tableLineColor: [203, 213, 225],
      tableLineWidth: 0.1,
      headStyles: {
        fillColor: [15, 76, 129],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle',
        fontSize: 9,
        cellPadding: 3,
      },
      styles: {
        fontSize: 7.5,
        cellPadding: 2,
        minCellHeight: 13,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        valign: 'middle',
        overflow: 'linebreak',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.cell.raw === '') return;
        const item = itensDaSemana[data.row.index];
        const color = statusColor(item);
        data.cell.styles.fillColor = item.reprogramado === 'SIM' ? [255, 251, 235] : [239, 246, 255];
        data.cell.styles.textColor = color;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.lineColor = color;
        data.cell.styles.lineWidth = 0.35;
      },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('Bandeirantes Deicmar - relatorio automatico de manutencao', 14, pageHeight - 8);
        doc.text(`Pagina ${doc.internal.getNumberOfPages()}`, pageWidth - 28, pageHeight - 8);
      },
    });

    doc.addPage();
    doc.setFillColor(15, 76, 129);
    doc.rect(0, 0, pageWidth, 22, 'F');
    doc.setFontSize(15);
    doc.setTextColor(15, 76, 129);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');
    doc.text('Detalhamento das Operacoes', 14, 14);
    autoTable(doc, {
      startY: 30,
      head: [['Maquina', 'Filial', 'OS', 'Tipo', 'Falha', 'Periodo', 'Responsavel', 'Status', 'Observacoes']],
      body: itensDaSemana.map((item) => [
        item.placa,
        item.filial,
        item.os || '-',
        item.tipo || '-',
        item.falha || '-',
        `Inicio: ${formatarDataHoraBR(item.data_parada)}\nFim: ${formatarDataHoraBR(item.data_final || item.prazo)}`,
        item.responsavel || '-',
        `${situacaoVisual(item)}${item.reprogramado === 'SIM' ? '\nREPROGRAMADO' : ''}`,
        item.observacoes || '-',
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 76, 129], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: 9, cellPadding: 3 },
      styles: { fontSize: 8.5, valign: 'middle', cellPadding: 3, lineColor: [226, 232, 240], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [15, 76, 129], cellWidth: 24 },
        1: { halign: 'center', cellWidth: 16 },
        2: { halign: 'center', cellWidth: 20 },
        3: { cellWidth: 34 },
        4: { cellWidth: 34 },
        5: { cellWidth: 40 },
        6: { cellWidth: 30 },
        7: { cellWidth: 30, fontStyle: 'bold' },
        8: { cellWidth: 48 },
      },
      didParseCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 7) return;
        const item = itensDaSemana[data.row.index];
        data.cell.styles.textColor = statusColor(item);
      },
      didDrawPage: () => {
        const pageHeight = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text('Bandeirantes Deicmar - relatorio automatico de manutencao', 14, pageHeight - 8);
        doc.text(`Pagina ${doc.internal.getNumberOfPages()}`, pageWidth - 28, pageHeight - 8);
      },
    });
    doc.save(`Plano_Manutencao_${dataInicio.replace(/\//g, '-')}.pdf`);
  };

  const montarConteudoEmail = () => {
    const linhas = itensDaSemana.map((item) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-weight:800;color:#0f4c81;">${item.placa || '-'}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${item.filial || '-'}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${item.os || '-'}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${item.tipo || '-'}<br><small>${item.falha || '-'}</small></td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${formatarDataHoraBR(item.data_parada)}<br>${formatarDataHoraBR(item.data_final || item.prazo)}</td>
        <td style="padding:10px;border-bottom:1px solid #e2e8f0;">${situacaoVisual(item)}${item.reprogramado === 'SIM' ? '<br><strong style="color:#dc2626;">REPROGRAMADO</strong>' : ''}</td>
      </tr>
    `).join('');

    const conteudoHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;font-size:12px;">
        <thead>
          <tr style="background-color:#f8fafc;color:#64748b;text-transform:uppercase;font-weight:800;">
            <th align="left" style="padding:10px;">Placa / Tag</th>
            <th align="left" style="padding:10px;">Filial</th>
            <th align="left" style="padding:10px;">OS</th>
            <th align="left" style="padding:10px;">Servico</th>
            <th align="left" style="padding:10px;">Periodo</th>
            <th align="left" style="padding:10px;">Status</th>
          </tr>
        </thead>
        <tbody>${linhas || '<tr><td colspan="6" style="padding:16px;text-align:center;color:#64748b;">Nenhuma manutencao programada.</td></tr>'}</tbody>
      </table>
    `;

    return `
      <div style="font-family:'Segoe UI',Tahoma,sans-serif;background-color:#f8fafc;padding:40px 20px;color:#1e293b;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="750" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.05);border:1px solid #e2e8f0;">
          <tr><td style="background:linear-gradient(to right,#0f4c81,#10b981);padding:40px 30px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:26px;text-transform:uppercase;letter-spacing:2px;font-weight:900;">Programacao de Manutencao</h1>
            <p style="color:rgba(255,255,255,0.85);margin:10px 0 0 0;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Unidade(s): <strong>${filiaisSelecionadas.join(', ')}</strong></p>
          </td></tr>
          <tr><td style="padding:30px;text-align:center;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:11px;font-weight:bold;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Total de Intervencoes na Semana</span><br>
            <span style="font-size:32px;font-weight:900;color:#0f4c81;">${itensDaSemana.length} Ordem(ns)</span>
          </td></tr>
          <tr><td style="padding:30px 30px 40px 30px;">
            <h2 style="color:#0f4c81;font-size:16px;margin:0 0 15px 0;font-weight:800;text-transform:uppercase;border-left:4px solid #10b981;padding-left:10px;">Cronograma Semanal</h2>
            ${conteudoHtml}
          </td></tr>
          <tr><td style="background-color:#0f4c81;padding:25px;text-align:center;">
            <p style="margin:0;font-size:11px;color:#ffffff;text-transform:uppercase;letter-spacing:1px;font-weight:bold;">Bandeirantes Deicmar - 2026</p>
            <p style="margin:8px 0 0 0;font-size:10px;color:rgba(255,255,255,0.6);">Este e um e-mail automatico.</p>
          </td></tr>
        </table>
      </div>
    `;
  };

  const postarNoGoogleScript = (payload) => {
    const iframeName = 'google-script-email-frame';
    let iframe = document.querySelector(`iframe[name="${iframeName}"]`);
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = EMAIL_SCRIPT_URL;
    form.target = iframeName;
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(payload);
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    window.setTimeout(() => form.remove(), 1000);
  };

  const enviarEmailProgramacao = async () => {
    if (!destinatariosEmail.trim()) {
      alert('Digite pelo menos um e-mail antes de enviar.');
      return;
    }
    if (!EMAIL_SCRIPT_URL) {
      alert('Configure VITE_GOOGLE_SCRIPT_EMAIL_URL no ambiente com a URL do Web App do Google Apps Script.');
      return;
    }

    setEnviandoEmail(true);
    try {
      const emailPayload = {
        to: destinatariosEmail,
        subject: `Programacao de Manutencao - ${diasDaSemana[0].toLocaleDateString('pt-BR')}`,
        html: montarConteudoEmail(),
        unidades: filiaisSelecionadas.join(', '),
        total_os: itensDaSemana.length,
      };

      postarNoGoogleScript(emailPayload);
      setModalExportarAberto(false);
      alert('Solicitacao enviada ao Google Script. Confira o e-mail e o historico de execucoes do Apps Script.');
    } catch (error) {
      alert(`Erro ao enviar e-mail: ${error.message}`);
    } finally {
      window.setTimeout(() => setEnviandoEmail(false), 1200);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans antialiased">
      <header className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] text-white p-4 shadow-lg flex flex-col sm:flex-row justify-between items-center sticky top-0 z-30 gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button onClick={() => navigate('/')} className="hover:bg-white/20 p-2 rounded-full transition" title="Voltar"><ChevronLeft /></button>
          <h1 className="font-black text-lg md:text-xl tracking-tight uppercase flex items-center gap-2"><Wrench size={20} /> Programacao</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={() => setModalExportarAberto(true)} className="flex-1 sm:flex-none bg-white/20 p-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold border border-white/20 hover:bg-white/30 transition"><FileText size={18} /> Exportar</button>
          <button onClick={abrirModalPlanilha} className="flex-1 sm:flex-none bg-white text-[#0f4c81] p-2 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-bold shadow-md hover:scale-105 transition"><Database size={18} /> Editor Base de Dados</button>
        </div>
      </header>

      <main className="p-4 max-w-[1750px] mx-auto space-y-6">
        <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center bg-white p-3 rounded-2xl shadow-sm border border-slate-100 gap-4">
          <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
              { id: 'kanban', label: 'Kanban', icon: Layout },
              { id: 'cronograma', label: 'Gantt Visual', icon: Calendar },
            ].map((aba) => {
              const Icone = aba.icon;
              return (
                <button key={aba.id} onClick={() => setAbaAtiva(aba.id)} className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${abaAtiva === aba.id ? 'bg-white text-[#0f4c81] shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>
                  <Icone size={16} /> {aba.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
              <Filter size={16} className="text-slate-400" />
              {['TODAS', ...FILIAIS].map((f) => (
                <button key={f} onClick={() => toggleSelecao(f, filiaisSelecionadas, setFiliaisSelecionadas)} className={`px-3 py-1 rounded-lg text-[10px] font-black transition-all ${filiaisSelecionadas.includes(f) ? 'bg-[#0f4c81] text-white' : 'bg-white border border-slate-200 text-slate-500'}`}>{f}</button>
              ))}
            </div>
            <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} className="bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-[#0f4c81] outline-none text-xs uppercase cursor-pointer">
              <option value="data">Ord: Por Data</option>
              <option value="prioridade">Ord: Por Prioridade</option>
            </select>
          </div>
        </div>

        {loading && <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center text-sm font-bold text-slate-400">Carregando programacao...</div>}

        {!loading && abaAtiva === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Atrasados', valor: cAtrasados, border: 'border-red-200', txt: 'text-red-600' },
                { label: 'Programados', valor: cProgramados, border: 'border-blue-100', txt: 'text-[#0f4c81]' },
                { label: 'Em Andamento', valor: cAndamento, border: 'border-amber-200', txt: 'text-amber-600' },
                { label: 'Aguardando Pe\u00e7a', valor: cAguardando, border: 'border-purple-200', txt: 'text-purple-600' },
                { label: 'Finalizados', valor: cFinalizados, border: 'border-emerald-200', txt: 'text-emerald-600' },
              ].map((card) => (
                <div key={card.label} className={`bg-white p-5 rounded-2xl border ${card.border} flex flex-col justify-between shadow-sm`}>
                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{card.label}</span>
                  <p className={`text-3xl font-black mt-3 ${card.txt}`}>{card.valor}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase flex items-center gap-2"><TrendingUp size={14} className="text-emerald-500" /> Eficiencia da Base</h3>
                  <span className="text-xs font-bold text-emerald-600">{totalGeral ? Math.round((cFinalizados / totalGeral) * 100) : 0}%</span>
                </div>
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-[#10b981] rounded-full transition-all duration-1000" style={{ width: `${totalGeral ? (cFinalizados / totalGeral) * 100 : 0}%` }} />
                </div>
              </div>

              <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm lg:col-span-2">
                <h3 className="text-xs font-black tracking-wider text-slate-400 uppercase mb-4">Volume por Etapa</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Atrasados', qtd: cAtrasados, cor: 'bg-red-500' },
                    { label: 'Programado', qtd: cProgramados, cor: 'bg-[#0f4c81]' },
                    { label: 'Em Andamento', qtd: cAndamento, cor: 'bg-amber-500' },
                    { label: 'Aguardando Pe\u00e7a', qtd: cAguardando, cor: 'bg-purple-500' },
                    { label: 'Finalizado', qtd: cFinalizados, cor: 'bg-emerald-500' },
                  ].map((barra) => {
                    const pct = totalGeral ? (barra.qtd / totalGeral) * 100 : 0;
                    return (
                      <div key={barra.label} className="flex items-center gap-4">
                        <span className="text-xs text-slate-500 font-bold w-28 truncate">{barra.label}</span>
                        <div className="flex-1 h-5 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 relative flex items-center">
                          <div className={`h-full ${barra.cor} opacity-10 absolute left-0 top-0 transition-all duration-700`} style={{ width: `${pct}%` }} />
                          <div className={`h-full ${barra.cor} w-1 absolute left-0 top-0`} />
                          <span className="text-[10px] font-bold text-slate-700 ml-3 z-10">{barra.qtd} <span className="text-slate-400 font-normal">({Math.round(pct)}%)</span></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {!loading && abaAtiva === 'kanban' && (
          <div className="flex flex-col md:flex-row gap-4 w-full h-auto md:h-[75vh] items-stretch animate-in fade-in duration-200">
            {COLUNAS_KANBAN.map((coluna) => {
              const isOpen = colunaAberta === coluna;
              const itens = dadosFiltradosGerais.filter((item) => situacaoVisual(item) === coluna);
              return (
                <div
                  key={coluna}
                  onDragOver={(e) => { e.preventDefault(); if (colunaAberta !== coluna) setColunaAberta(coluna); }}
                  onDrop={(e) => onDropKanban(e, coluna)}
                  onClick={() => !isOpen && setColunaAberta(coluna)}
                  className={`transition-all duration-500 flex flex-col bg-white rounded-2xl border ${isOpen ? 'border-slate-200 flex-1 shadow-md min-h-[300px]' : 'border-slate-100 h-14 md:h-full md:w-[65px] cursor-pointer hover:bg-slate-50'}`}
                >
                  <div className={`p-4 flex justify-between items-center bg-slate-50 border-b border-slate-100 ${!isOpen && 'md:h-full md:flex-col md:justify-start md:pt-8'}`}>
                    <h3 className={`font-black uppercase tracking-widest text-xs ${coluna === 'ATRASADOS' ? 'text-red-600' : 'text-[#0f4c81]'} ${isOpen ? '' : 'md:[writing-mode:vertical-lr] md:rotate-180'}`}>{coluna}</h3>
                    <span className={`font-bold rounded-full flex items-center justify-center text-xs ${coluna === 'ATRASADOS' ? 'bg-red-100 text-red-700' : 'bg-[#0f4c81] text-white'} ${isOpen ? 'px-2.5 py-0.5' : 'w-6 h-6 md:mt-4'}`}>{itens.length}</span>
                  </div>

                  {isOpen && (
                    <div className="p-3 overflow-y-auto h-full flex flex-wrap gap-3 items-start content-start bg-slate-50/40">
                      {itens.map((item) => (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={(e) => onDragStartKanban(e, item)}
                          onClick={abrirModalPlanilha}
                          className={`p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing w-full sm:w-[calc(50%-6px)] xl:w-[calc(33.33%-8px)] border-l-4 ${checarSeAtrasado(item) ? 'border-l-red-500' : 'border-l-[#0f4c81]'}`}
                        >
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="font-black text-slate-700 text-base">{item.placa}</h4>
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase border border-slate-200">OS: {item.os || '-'}</span>
                          </div>
                          <p className="text-[10px] font-black text-red-500 mb-2 uppercase tracking-wide truncate">{item.tipo} - {item.falha}</p>
                          {item.reprogramado === 'SIM' && <span className="inline-flex text-[9px] font-black text-red-700 bg-red-50 border border-red-200 rounded px-2 py-0.5">REPROGRAMADO</span>}
                          <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                            <span className="truncate">Resp: <strong className="text-slate-600">{item.responsavel || '-'}</strong></span>
                            <span className="font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 shrink-0 border border-slate-200/60">{item.filial}</span>
                          </div>
                        </div>
                      ))}
                      {!itens.length && <p className="text-[11px] text-slate-400 font-bold italic p-4 mx-auto">Nenhuma programacao cadastrada.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && abaAtiva === 'cronograma' && (
        <div className="bg-white rounded-[2rem] shadow-xl border border-white overflow-visible flex flex-col">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 p-4 bg-slate-50 rounded-t-[2rem] border-b border-slate-100">
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <h2 className="font-black text-[#0f4c81] uppercase tracking-widest text-sm ml-0 sm:ml-4">
                Gantt Visual
              </h2>
      
              <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
                <button
                  onClick={prevWeek}
                  className="p-2 hover:bg-slate-100 rounded-md transition text-slate-500"
                  title="Semana anterior"
                >
                  <LeftIcon size={18} />
                </button>
      
                <button
                  onClick={resetWeek}
                  className="px-2 md:px-4 font-bold text-[10px] md:text-xs uppercase text-[#0f4c81] hover:bg-slate-50 transition"
                >
                  Hoje
                </button>
      
                <button
                  onClick={nextWeek}
                  className="p-2 hover:bg-slate-100 rounded-md transition text-slate-500"
                  title="Proxima semana"
                >
                  <RightIcon size={18} />
                </button>
              </div>
            </div>
          </div>
      
          <div
            ref={ganttScrollRef}
            onDragOver={handleDragOverGantt}
            className="overflow-x-auto overflow-y-auto max-h-[65vh] pb-32"
          >
            <table
              className="text-sm border-collapse"
              style={{ minWidth: `${diasGantt.length * LARGURA_DIA_GANTT}px` }}
            >
                <thead className="sticky top-0 z-[70]">
                  <tr className="bg-slate-100/95 backdrop-blur-md shadow-sm border-b border-slate-200">
                   {diasGantt.map((dia, idx) => (
                   <th key={idx} className="p-4 text-center border-r border-slate-200/60" style={{ width: `${LARGURA_DIA_GANTT}px` }}>
                    <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">{DIAS_SEMANA[idx % 7]}</span>
                        <span className={`text-base md:text-xl font-black ${dia.toDateString() === new Date().toDateString() ? 'text-[#10b981] bg-emerald-100/50 px-2 rounded-lg' : 'text-[#0f4c81]'}`}>{dia.getDate()}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 relative">
                  {itensGantt.map((item) => {
                    const dataParada = parseDate(item.data_parada);
                    const dataFimReal = parseDate(item.data_final || item.prazo || item.data_parada) || dataParada;
                    if (!dataParada || !dataFimReal) return null;
                    dataParada.setHours(0, 0, 0, 0);
                    dataFimReal.setHours(0, 0, 0, 0);
                   let startIdx = diasGantt.findIndex((d) => d.getTime() === dataParada.getTime());
                    if (startIdx === -1 && dataParada < diasGantt[0]) startIdx = 0;
                    let endIdx = diasGantt.findIndex((d) => d.getTime() === dataFimReal.getTime());
                    if (endIdx === -1 && dataFimReal > diasGantt[diasGantt.length - 1]) endIdx = diasGantt.length - 1;
                    const spanDays = Math.max((endIdx - startIdx) + 1, 1);

                    return (
                      <tr key={item.id} className="h-20 relative hover:z-[100] transition-colors">
                        {diasGantt.map((dia, colIdx) => (
                        <td key={colIdx} onClick={() => abrirModalNovaManutencao(dia)} onDragOver={handleDragOverGantt} onDrop={(e) => onDropGantt(e, dia)} className="border-r border-slate-100/50 relative cursor-pointer hover:bg-blue-50/50 transition-colors" style={{ width: `${LARGURA_DIA_GANTT}px` }} title="Clique para adicionar manutencao neste dia" >
                            {startIdx === colIdx && (
                              <div
                              draggable
                              onClick={(e) => e.stopPropagation()}
                              onDragStart={(e) => onDragStartGantt(e, item)}
                              className="absolute inset-y-2 left-2 z-10 hover:z-[100] group cursor-grab active:cursor-grabbing"
                                style={{ width: `${(spanDays * LARGURA_DIA_GANTT) - 16}px` }}
                              >
                                <div
                                  onDoubleClick={() => abrirModalPlanilhaComItem(item)}
                                  className={`h-full w-full rounded-2xl shadow-md p-2 md:p-4 text-white flex items-center justify-between border-2 border-white/20 hover:brightness-110 hover:shadow-lg transition-all relative overflow-hidden ${item.reprogramado === 'SIM' ? 'bg-gradient-to-r from-red-600 to-amber-500' : 'bg-gradient-to-r from-[#0f4c81] to-[#10b981]'}`}
                                >
                                  <div className="flex flex-col truncate pr-2 md:pr-6">
                                    <div className="flex items-center gap-1 md:gap-2">
                                      <span className="font-black text-[10px] md:text-sm uppercase tracking-tighter">{item.placa}</span>
                                      <span className="text-[8px] md:text-[9px] font-black bg-black/20 px-1 md:px-2 py-0.5 rounded uppercase tracking-tighter">OS: {item.os || '-'}</span>
                                    </div>
                                    <span className="text-[9px] md:text-[11px] font-bold opacity-90 truncate italic mt-1">{item.reprogramado === 'SIM' ? 'REPROGRAMADO - ' : ''}{item.observacoes || item.tipo}</span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      abrirModalPlanilhaComItem(item);
                                    }}
                                    onDragStart={(e) => e.preventDefault()}
                                    className="absolute right-1 md:right-4 opacity-70 group-hover:opacity-100 hover:bg-white/20 p-1 rounded-lg transition"
                                    title="Editar manutencao"
                                  >
                                    <Edit3 size={14} className="md:w-[18px] md:h-[18px]" />
                                  </button>
                                </div>
                                <div className="pointer-events-none absolute left-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-700 shadow-2xl opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 z-[200]">
                                  <div className="font-black text-[#0f4c81] text-xs uppercase mb-2 truncate">{item.placa || '-'} {item.reprogramado === 'SIM' ? '- REPROGRAMADO' : ''}</div>
                                  <div className="grid grid-cols-[88px_1fr] gap-x-2 gap-y-1">
                                    <span className="font-black text-slate-400 uppercase">Manutencao</span><span className="font-bold">{item.tipo || '-'}</span>
                                    <span className="font-black text-slate-400 uppercase">Responsavel</span><span className="font-bold">{item.responsavel || '-'}</span>
                                    <span className="font-black text-slate-400 uppercase">Falha</span><span className="font-bold">{item.falha || '-'}</span>
                                    <span className="font-black text-slate-400 uppercase">OS</span><span className="font-bold">{item.os || '-'}</span>
                                    <span className="font-black text-slate-400 uppercase">Observacoes</span><span className="font-bold whitespace-normal">{item.observacoes || '-'}</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {modalPlanilhaAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-white w-full h-full md:h-[95vh] rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-4 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 shrink-0 text-white shadow-md">
              <div className="flex flex-wrap items-center justify-between md:justify-start gap-3">
                <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><Database size={18} /> Editor Base de Dados</h2>
                <button onClick={adicionarNovaLinha} className="bg-white text-[#0f4c81] hover:bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition shadow-sm"><PlusCircle size={14} /> Nova Linha</button>
                <button onClick={salvarTudo} disabled={salvandoTudo} className="bg-emerald-900/30 border border-white/25 text-white hover:bg-emerald-900/45 px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition disabled:opacity-60"><Save size={14} /> {salvandoTudo ? 'Salvando...' : 'Salvar Geral'}</button>
              </div>

              <div className="flex flex-wrap items-center gap-2 bg-black/10 p-1.5 rounded-xl border border-white/10">
                <div className="relative flex items-center bg-white rounded-lg px-2 py-1 w-full sm:w-48">
                  <Search size={12} className="text-slate-400 mr-1.5 shrink-0" />
                  <input type="text" placeholder="Filtrar..." value={buscaEditor} onChange={(e) => setBuscaEditor(e.target.value)} className="bg-transparent text-xs text-slate-800 outline-none placeholder-slate-400 w-full font-bold uppercase" />
                </div>
                <div className="flex bg-white rounded-lg p-0.5 overflow-hidden border border-slate-200 shadow-sm">
                  {['TODAS', ...FILIAIS].map((f) => (
                    <button key={f} onClick={() => toggleSelecao(f, filiaisEditor, setFiliaisEditor)} className={`px-2 py-1 text-[10px] font-bold transition-all rounded ${filiaisEditor.includes(f) ? 'bg-[#0f4c81] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>{f}</button>
                  ))}
                </div>
                <select value={ordenacaoEditor} onChange={(e) => setOrdenacaoEditor(e.target.value)} className="bg-white text-slate-700 text-xs font-bold p-1.5 rounded-lg outline-none cursor-pointer">
                  <option value="recente">Ord: Mais Recentes</option>
                  <option value="placa">Ord: Placa A-Z</option>
                  <option value="prioridade">Ord: Prioridade</option>
                </select>
                <button onClick={() => setModalPlanilhaAberto(false)} className="hover:bg-white/20 p-1.5 rounded-lg text-white transition ml-auto md:ml-2" title="Fechar"><X size={18} /></button>
              </div>
            </div>

            <div className="overflow-x-auto overflow-y-auto flex-1 bg-slate-100 p-2">
              <table className="w-full text-left border-collapse min-w-[1900px] bg-white rounded-xl shadow-sm overflow-hidden">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                  <tr className="text-slate-500 text-[9px] font-black uppercase tracking-wider">
                    <th className="p-2 w-24 text-center">Acoes</th>
                    <th className="p-2 w-32">Placa / Tag</th>
                    <th className="p-2 w-24">OS</th>
                    <th className="p-2 w-24">Filial</th>
                    <th className="p-2 w-34">Situacao</th>
                    <th className="p-2 w-28">Prioridade</th>
                    <th className="p-2 w-44">Manutencao</th>
                    <th className="p-2 w-44">Falha</th>
                    <th className="p-2 w-24">Duracao</th>
                    <th className="p-2 w-24">Reprog.</th>
                    <th className="p-2 w-36">Responsavel</th>
                    <th className="p-2 w-56">Datas e Prazos</th>
                    <th className="p-2 min-w-[220px]">Observacoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhasEditorFiltradas.map((linha, index) => (
                    <tr key={`${linha.id || 'nova'}-${index}`} className={`transition-colors ${!linha.id ? 'bg-amber-100/80 shadow-[inset_4px_0_0_0_#f59e0b]' : 'hover:bg-slate-50'}`}>
                      <td className="p-1 border-r border-slate-100 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => salvarLinha(linha)} className="p-1 bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded" title="Salvar"><Save size={13} /></button>
                          <button onClick={() => duplicarLinha(linha)} className="p-1 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded" title="Duplicar"><Copy size={13} /></button>
                          <button onClick={() => handleExcluir(linha)} className="p-1 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded" title="Excluir"><Trash2 size={13} /></button>
                        </div>
                      </td>
                      <td className="p-1 border-r border-slate-100">
                        <DatalistInput campo="placa" value={linha.placa} options={opcoesPlaca} onChange={(valor) => atualizarLinha(linha, 'placa', valor)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-black uppercase text-slate-700 outline-none focus:border-[#0f4c81]" />
                      </td>
                      <td className="p-1 border-r border-slate-100"><input type="text" value={linha.os || ''} onChange={(e) => atualizarLinha(linha, 'os', e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" /></td>
                      <td className="p-1 border-r border-slate-100"><DatalistInput campo="filial" value={linha.filial} options={FILIAIS} onChange={(valor) => atualizarLinha(linha, 'filial', normalizarTexto(valor))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none" /></td>
                      <td className="p-1 border-r border-slate-100"><DatalistInput campo="situacao" value={linha.situacao} options={COLUNAS_KANBAN} onChange={(valor) => atualizarLinha(linha, 'situacao', normalizarTexto(valor))} className="w-full px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded text-xs font-bold outline-none" /></td>
                      <td className="p-1 border-r border-slate-100"><DatalistInput campo="prioridade" value={linha.prioridade} options={PRIORIDADES} onChange={(valor) => atualizarLinha(linha, 'prioridade', normalizarTexto(valor))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none" /></td>
                      <td className="p-1 border-r border-slate-100"><DatalistInput campo="tipo" value={linha.tipo} options={TIPOS_MANUTENCAO} onChange={(valor) => atualizarLinha(linha, 'tipo', normalizarTexto(valor))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none" /></td>
                      <td className="p-1 border-r border-slate-100"><DatalistInput campo="falha" value={linha.falha} options={FALHAS} onChange={(valor) => atualizarLinha(linha, 'falha', normalizarTexto(valor))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-700 outline-none" /></td>
                      <td className="p-1 border-r border-slate-100"><DatalistInput campo="duracao" value={linha.duracao} options={DURACAO} onChange={(valor) => atualizarLinha(linha, 'duracao', normalizarTexto(valor))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] font-bold text-slate-600 outline-none" /></td>
                      <td className="p-1 border-r border-slate-100">
                        <DatalistInput campo="reprogramado" value={linha.reprogramado || 'N\u00c3O'} options={OPCOES_SIM_NAO} onChange={(valor) => atualizarLinha(linha, 'reprogramado', normalizarTexto(valor))} className={`w-full px-2 py-1 border rounded text-[10px] font-bold outline-none ${linha.reprogramado === 'SIM' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-slate-50 border-slate-200 text-slate-600'}`} />
                        {linha.reprogramado === 'SIM' && <span className="mt-1 inline-flex text-[8px] font-black text-red-700">REPROGRAMADO</span>}
                      </td>
                      <td className="p-1 border-r border-slate-100"><input type="text" placeholder="Responsavel..." value={linha.responsavel || ''} onChange={(e) => atualizarLinha(linha, 'responsavel', normalizarTexto(e.target.value))} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" /></td>
                      <td className="p-1 border-r border-slate-100 text-[9px] text-slate-400 space-y-0.5">
                        <div className="flex items-center gap-1"><span className="w-8 text-slate-400 font-bold">Inicio:</span><input type="datetime-local" value={formatDtInput(linha.data_parada)} onChange={(e) => atualizarLinha(linha, 'data_parada', e.target.value)} className="bg-slate-50 border border-slate-200 rounded p-0.5 text-slate-700 w-full outline-none" /></div>
                        <div className="flex items-center gap-1"><span className="w-8 text-slate-400 font-bold">Prazo:</span><input type="datetime-local" value={formatDtInput(linha.prazo)} onChange={(e) => atualizarLinha(linha, 'prazo', e.target.value)} className="bg-slate-50 border border-slate-200 rounded p-0.5 text-slate-700 w-full outline-none" /></div>
                        <div className="flex items-center gap-1"><span className="w-8 text-emerald-600 font-bold">Fim:</span><input type="datetime-local" value={formatDtInput(linha.data_final)} onChange={(e) => atualizarLinha(linha, 'data_final', e.target.value)} className="bg-emerald-50 border border-emerald-200 rounded p-0.5 text-emerald-700 w-full outline-none" /></div>
                      </td>
                      <td className="p-1"><textarea rows="2" placeholder="..." value={linha.observacoes || ''} onChange={(e) => atualizarLinha(linha, 'observacoes', e.target.value)} className="w-full px-2 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded text-[10px] resize-none outline-none focus:border-[#0f4c81]" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalNovaManutencaoAberto && (
  <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 md:p-4">
    <div className="bg-white w-full h-full md:h-auto md:max-h-[92vh] md:max-w-5xl rounded-none md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
      <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-4 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 shrink-0 text-white shadow-md">
        <div>
          <h2 className="font-black text-sm uppercase tracking-widest flex items-center gap-2"><PlusCircle size={18} /> Nova manutencao</h2>
          <p className="text-[11px] text-white/75 font-bold mt-1">Atalho do Gantt com os mesmos campos do editor base de dados.</p>
        </div>
        <button onClick={() => setModalNovaManutencaoAberto(false)} className="hover:bg-white/20 p-2 rounded-lg text-white transition self-end sm:self-auto" title="Fechar"><X size={18} /></button>
      </div>

      <div className="overflow-y-auto p-4 md:p-6 bg-slate-100">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Placa / Tag</span>
            <DatalistInput campo="nova-placa" value={novaManutencao.placa} options={opcoesPlaca} onChange={(valor) => atualizarNovaManutencao('placa', valor)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-black uppercase text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">OS</span>
            <input type="text" value={novaManutencao.os || ''} onChange={(e) => atualizarNovaManutencao('os', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filial</span>
            <DatalistInput campo="nova-filial" value={novaManutencao.filial} options={FILIAIS} onChange={(valor) => atualizarNovaManutencao('filial', normalizarTexto(valor))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Situacao</span>
            <DatalistInput campo="nova-situacao" value={novaManutencao.situacao} options={COLUNAS_KANBAN} onChange={(valor) => atualizarNovaManutencao('situacao', normalizarTexto(valor))} className="w-full px-3 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs font-bold outline-none focus:border-amber-400" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Prioridade</span>
            <DatalistInput campo="nova-prioridade" value={novaManutencao.prioridade} options={PRIORIDADES} onChange={(valor) => atualizarNovaManutencao('prioridade', normalizarTexto(valor))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Manutencao</span>
            <DatalistInput campo="nova-tipo" value={novaManutencao.tipo} options={TIPOS_MANUTENCAO} onChange={(valor) => atualizarNovaManutencao('tipo', normalizarTexto(valor))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Falha</span>
            <DatalistInput campo="nova-falha" value={novaManutencao.falha} options={FALHAS} onChange={(valor) => atualizarNovaManutencao('falha', normalizarTexto(valor))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Duracao</span>
            <DatalistInput campo="nova-duracao" value={novaManutencao.duracao} options={DURACAO} onChange={(valor) => atualizarNovaManutencao('duracao', normalizarTexto(valor))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Reprogramado</span>
            <DatalistInput campo="nova-reprogramado" value={novaManutencao.reprogramado || 'NÃO'} options={OPCOES_SIM_NAO} onChange={(valor) => atualizarNovaManutencao('reprogramado', normalizarTexto(valor))} className={`w-full px-3 py-2 border rounded-lg text-xs font-bold outline-none ${novaManutencao.reprogramado === 'SIM' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-700'}`} />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Responsavel</span>
            <input type="text" value={novaManutencao.responsavel || ''} onChange={(e) => atualizarNovaManutencao('responsavel', normalizarTexto(e.target.value))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Inicio</span>
            <input type="datetime-local" value={formatDtInput(novaManutencao.data_parada)} onChange={(e) => atualizarNovaManutencao('data_parada', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Prazo</span>
            <input type="datetime-local" value={formatDtInput(novaManutencao.prazo)} onChange={(e) => atualizarNovaManutencao('prazo', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
          </label>

          <label className="space-y-1">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Fim</span>
            <input type="datetime-local" value={formatDtInput(novaManutencao.data_final)} onChange={(e) => atualizarNovaManutencao('data_final', e.target.value)} className="w-full px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-700 outline-none focus:border-emerald-400" />
          </label>
        </div>

        <label className="block space-y-1 mt-4">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Observacoes</span>
          <textarea rows="4" value={novaManutencao.observacoes || ''} onChange={(e) => atualizarNovaManutencao('observacoes', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs resize-none outline-none focus:border-[#0f4c81]" />
        </label>
      </div>

      <div className="p-4 bg-white border-t border-slate-100 flex flex-col sm:flex-row justify-end gap-3">
        <button onClick={() => setModalNovaManutencaoAberto(false)} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border border-slate-200 text-slate-500 hover:bg-slate-50 transition">Cancelar</button>
        <button onClick={salvarNovaManutencao} disabled={salvandoNovaManutencao} className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-[#0f4c81] text-white hover:bg-[#0b3b65] disabled:opacity-60 transition flex items-center justify-center gap-2">
          <Save size={16} /> {salvandoNovaManutencao ? 'Salvando...' : 'Salvar manutencao'}
        </button>
      </div>
    </div>
  </div>
)}

      {modalExportarAberto && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-gradient-to-r from-[#0f4c81] to-[#10b981] p-4 text-white flex justify-between items-center">
              <h2 className="text-xs font-black uppercase tracking-widest">Opcoes de Relatorio</h2>
              <button onClick={() => setModalExportarAberto(false)} className="hover:bg-white/20 p-1 rounded-full text-white transition" title="Fechar"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Destinatarios de E-mail</label>
                <input type="text" placeholder="email@empresa.com.br (separe por virgula)" value={destinatariosEmail} onChange={(e) => setDestinatariosEmail(e.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#0f4c81]" />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <button onClick={() => { setModalExportarAberto(false); gerarRelatorioPDF(); }} className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-2 text-[#0f4c81] transition"><Printer size={20} /> Baixar PDF</button>
                <button onClick={enviarEmailProgramacao} disabled={enviandoEmail} className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl font-bold uppercase text-[10px] flex flex-col items-center gap-2 text-emerald-700 transition disabled:opacity-60"><Mail size={20} /> {enviandoEmail ? 'Enviando...' : 'Enviar E-mail'}</button>
              </div>
              {!EMAIL_SCRIPT_URL && <p className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2">Defina VITE_GOOGLE_SCRIPT_EMAIL_URL para ativar o envio via Google Script.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Programacao;
