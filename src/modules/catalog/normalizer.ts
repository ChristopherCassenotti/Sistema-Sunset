
import type { HiperProduto } from "../../integrations/hiper/client.js";

type Condicao = "lacrado" | "seminovo";

export type UnidadeIphone = {
  hiperId: string;
  codigo: string | null;
  nomeOriginal: string;
  modelo: string;
  cor: string;
  armazenamento: string;
  condicao: Condicao;
  bateria: number | null;
  preco: number;
  quantidade: number;
};

export type GrupoIphone = {
  chave: string;
  modelo: string;
  cor: string;
  armazenamento: string;
  condicao: Condicao;
  quantidadeTotal: number;
  precoMinimo: number;
  precoMaximo: number;
  unidades: UnidadeIphone[];
};

type Extracao = Pick<
  UnidadeIphone,
  "modelo" | "cor" | "armazenamento" | "condicao" | "bateria"
>;

// Padroniza textos para comparação
function chaveNormalizada(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

// Extrai os dados que estão no nome do produto
function interpretarNome(nome: string): Extracao | null {

  const modelo = /^\s*iphone\s+(?:\d{1,2}[se]?|xr|xs|x|se|air)(?:\s+(?:pro\s+max|pro|plus|mini|air|max))?\b/i.exec(nome);

  if (!modelo) return null;

  const resto = nome.slice(modelo[0].length);

  // Identifica 64GB, 128GB, 256GB, 1TB etc.
  const memoria = /\b(\d{1,4})\s*(GB|TB)\b/i.exec(resto);

  if (!memoria || memoria.index === undefined) {
    return null;
  }

  // Extrai a cor entre o modelo e o armazenamento
  const cor = resto
    .slice(0, memoria.index)
    .replace(/^[\s,;:/-]+|[\s,;:/-]+$/g, "")
    .trim();

  if (!cor) return null;

  const nomeNormalizado = chaveNormalizada(nome);

  // Identifica condição
  const usado = /\b(USADO|SEMINOVO|SEMI NOVO)\b/.test(
    nomeNormalizado
  );

  const novo = /\b(NOVO|LACRADO)\b/.test(
    nomeNormalizado
  );

  // Não publica produto sem condição identificável
  if (usado === novo) return null;

  // Identifica saúde da bateria quando informada
  const percentual = /\b(100|[1-9]?\d)\s*%/.exec(nome);

  const modeloFormatado = modelo[0]
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^iphone/i, "iPhone")
    .replace(
      /\b(pro|max|plus|mini|air)\b/gi,
      (p) => p[0]!.toUpperCase() + p.slice(1).toLowerCase()
    )
    .replace(/\b(xr|xs|se)\b/gi, (p) => p.toUpperCase());

  return {
    modelo: modeloFormatado,
    cor,
    armazenamento:
      `${Number(memoria[1])}${memoria[2]!.toUpperCase()}`,
    condicao: usado ? "seminovo" : "lacrado",
    bateria: usado && percentual
      ? Number(percentual[1])
      : null,
  };
}

// Função principal: filtra e agrupa os produtos
export function montarCatalogo(produtos: HiperProduto[]) {

  const grupos = new Map<string, GrupoIphone>();
  const ids = new Set<string>();

  const exclusoes: Record<string, number> = {};

  const exemplosParaRevisao: Array<{
    motivo: string;
    nome: string;
  }> = [];

  let unidadesDisponiveis = 0;
  let registrosValidos = 0;

  function excluir(motivo: string, nome: string) {
    exclusoes[motivo] = (exclusoes[motivo] ?? 0) + 1;

    if (
      motivo === "cadastro-incompleto" &&
      exemplosParaRevisao.length < 10
    ) {
      exemplosParaRevisao.push({ motivo, nome });
    }
  }

  for (const produto of produtos) {

    const nome = produto.nome ?? "";
    const categoria = chaveNormalizada(
      produto.categoria ?? ""
    );

    // 1. Somente categoria iPhone e nomes de aparelho
    if (
      !/^IPHONES?$/.test(categoria) ||
      !/^\s*iphone\s/i.test(nome)
    ) {
      excluir("fora-da-categoria-iphone", nome);
      continue;
    }

    // 2. Não contar o mesmo ID duas vezes
    if (!produto.id || ids.has(produto.id)) {
      excluir("id-ausente-ou-repetido", nome);
      continue;
    }

    ids.add(produto.id);

    // 3. Somente produtos ativos e não removidos
    if (
      produto.ativo !== true ||
      produto.removido !== false
    ) {
      excluir("inativo-ou-removido", nome);
      continue;
    }

    // 4. Grades precisam de tratamento próprio
    if (produto.grade === true) {
      excluir("produto-com-grade-requer-validacao", nome);
      continue;
    }

    // 5. Somente produtos com estoque positivo
    const saldo = produto.quantidadeEmEstoque;

    if (
      typeof saldo !== "number" ||
      !Number.isSafeInteger(saldo) ||
      saldo <= 0
    ) {
      excluir("sem-estoque-ou-saldo-invalido", nome);
      continue;
    }

    // 6. Validar preço
    const preco = produto.preco;

    if (
      typeof preco !== "number" ||
      !Number.isFinite(preco) ||
      preco <= 0
    ) {
      excluir("preco-invalido", nome);
      continue;
    }

    // 7. Extrair modelo, cor, bateria e condição
    const dados = interpretarNome(nome);

    if (!dados) {
      excluir("cadastro-incompleto", nome);
      continue;
    }

    const unidade: UnidadeIphone = {
      hiperId: produto.id,
      codigo: produto.codigo == null
        ? null
        : String(produto.codigo),
      nomeOriginal: nome,
      ...dados,
      preco,
      quantidade: saldo,
    };

    // 8. Criar chave de agrupamento visual
    const chave = [
      dados.modelo,
      dados.armazenamento,
      dados.cor,
      dados.condicao
    ].map(chaveNormalizada).join("|");

    let grupo = grupos.get(chave);

    if (!grupo) {
      grupo = {
        chave,
        modelo: dados.modelo,
        armazenamento: dados.armazenamento,
        cor: dados.cor,
        condicao: dados.condicao,
        quantidadeTotal: 0,
        precoMinimo: preco,
        precoMaximo: preco,
        unidades: [],
      };

      grupos.set(chave, grupo);
    }

    // Mantém cada ID original do Hiper
    grupo.unidades.push(unidade);

    // Soma o estoque dos registros do grupo
    grupo.quantidadeTotal += saldo;

    // Calcula faixa de preços
    grupo.precoMinimo = Math.min(
      grupo.precoMinimo, preco
    );

    grupo.precoMaximo = Math.max(
      grupo.precoMaximo, preco
    );

    unidadesDisponiveis += saldo;
    registrosValidos++;
  }

  return {
    grupos: [...grupos.values()].sort((a, b) =>
      a.modelo.localeCompare(b.modelo, "pt-BR", {
        numeric: true
      }) ||
      a.armazenamento.localeCompare(
        b.armazenamento, "pt-BR", { numeric: true }
      ) ||
      a.cor.localeCompare(b.cor, "pt-BR")
    ),

    diagnostico: {
      recebidos: produtos.length,
      registrosValidos,
      unidadesDisponiveis,
      exclusoes,
      exemplosParaRevisao,
    },
  };
}
