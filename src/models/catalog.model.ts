
export interface OpcaoCatalogo {
  preco: number;
  bateria: number | null;
  quantidade: number;
}

export interface ProdutoCatalogo {
  id: string;
  nome: string;
  modelo: string;
  armazenamento: string;
  cor: string;
  condicao: string;
  precoAVista: number;
  precoMaximo: number;
  quantidadeDisponivel: number;
  disponivel: boolean;
  opcoes: OpcaoCatalogo[];
}

export interface RespostaCatalogo {
  loja: string;
  consultadoEm: string;
  atualizadoEm: string | null;
  totalProdutos: number;
  totalUnidades: number;
  produtos: ProdutoCatalogo[];
}
