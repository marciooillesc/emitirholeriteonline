// ===== Helpers BRL =====
function sanitizeMoneyText(v){
  v = String(v ?? "").replace(/[^\d,.\-]/g, "");
  v = v.replace(/(?!^)-/g, ""); // mantém só 1 sinal -
  return v;
}
function parseMoneyBR(v){
  if (!v) return 0;
  v = String(v).trim().replace(/R\$\s?/g, "").replace(/\s/g, "");
  if (v.includes(",")) {
    v = v.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function money(n){
  return (n || 0).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}
function clamp(n, min, max){ return Math.min(Math.max(n, min), max); }

// ===== Tabelas oficiais (2026) =====
// INSS empregado (competência Jan/2026) – faixas e alíquotas progressivas
// Fonte: INSS/Gov.br :contentReference[oaicite:2]{index=2}
const INSS_2026 = [
  { upTo: 1621.00, rate: 0.075 },
  { upTo: 2902.84, rate: 0.09  },
  { upTo: 4354.27, rate: 0.12  },
  { upTo: 8475.55, rate: 0.14  },
];

// IRRF mensal 2026 (a partir de Jan/2026)
// Fonte: Receita Federal :contentReference[oaicite:3]{index=3}
const IRRF_2026 = [
  { upTo: 2428.80, rate: 0.00, ded: 0.00   },
  { upTo: 2826.65, rate: 0.075, ded: 182.16 },
  { upTo: 3751.05, rate: 0.15,  ded: 394.16 },
  { upTo: 4664.68, rate: 0.225, ded: 675.49 },
  { upTo: Infinity, rate: 0.275, ded: 908.73 },
];

// Deduções 2026
// Dependente: R$ 189,59; Desconto simplificado (limite mensal): R$ 607,20
// Fonte: Receita Federal :contentReference[oaicite:4]{index=4}
const DED_DEP_2026 = 189.59;
const DESC_SIMP_2026 = 607.20;

// Regra de redução do imposto (Lei 15.270/2025) – tabela de redução mensal
// Fonte: Receita Federal :contentReference[oaicite:5]{index=5}
function reductionIRRF(grossSalary, impostoCalculado){
  if (grossSalary <= 5000.00) {
    return impostoCalculado; // zera
  }
  if (grossSalary <= 7350.00) {
    const red = 978.62 - (0.133145 * grossSalary);
    return clamp(red, 0, impostoCalculado);
  }
  return 0;
}

// ===== Cálculos =====
function calcINSSProgressivo(salario){
  let total = 0;
  let prev = 0;

  for (const faixa of INSS_2026){
    const teto = faixa.upTo;
    const baseFaixa = clamp(salario, 0, teto) - prev;
    if (baseFaixa > 0) total += baseFaixa * faixa.rate;
    prev = teto;
    if (salario <= teto) break;
  }
  return Math.max(0, total);
}

function calcIRRF2026({ salarioBruto, inss, dependentes, usarDescontoSimplificado }){
  const deps = Math.max(0, Math.floor(dependentes || 0));

  // Base com deduções legais (INSS + dependentes)
  const dedLegal = inss + (deps * DED_DEP_2026);
  const baseLegal = Math.max(0, salarioBruto - dedLegal);

  // Base com desconto simplificado (substitui deduções legais)
  const baseSimp = Math.max(0, salarioBruto - DESC_SIMP_2026);

  // Escolha (se marcado): aplica a base que dá MENOR imposto
  // (mais vantajoso para o trabalhador, como nos exemplos da RFB)
  let base = baseLegal;
  if (usarDescontoSimplificado) {
    base = baseSimp; // escolhe depois pelo imposto, não só pela base
  }

  function impostoPelaTabela(baseCalc){
    // encontra faixa
    const faixa = IRRF_2026.find(f => baseCalc <= f.upTo) || IRRF_2026[IRRF_2026.length - 1];
    const imposto = Math.max(0, (baseCalc * faixa.rate) - faixa.ded);
    return imposto;
  }

  const impLegal = impostoPelaTabela(baseLegal);
  const impSimp  = impostoPelaTabela(baseSimp);

  let imposto = impLegal;
  let baseEscolhida = baseLegal;
  let modo = "legal";

  if (usarDescontoSimplificado && impSimp <= impLegal) {
    imposto = impSimp;
    baseEscolhida = baseSimp;
    modo = "simplificado";
  }

  // Redução/isenção (baseada no rendimento tributável mensal, aqui: salário bruto)
  const red = reductionIRRF(salarioBruto, imposto);
  const impostoFinal = Math.max(0, imposto - red);

  return { baseIrrf: baseEscolhida, irrf: impostoFinal, modo };
}

// ===== UI =====
const el = (id) => document.getElementById(id);

const salarioEl = el("salario");
const dependEl  = el("dependentes");
const simpEl    = el("usarDescontoSimplificado");

const vSalarioEl = el("vSalario");
const dInssEl    = el("dInss");
const dIrrfEl    = el("dIrrf");

const totalVEl = el("totalV");
const totalDEl = el("totalD");
const liquidoEl = el("liquido");

const baseInssEl = el("baseInss");
const baseIrrfEl = el("baseIrrf");
const fgtsEl     = el("fgts");

el("btnPrint").addEventListener("click", () => window.print());

function recalc(){
  // Sanitize input
  salarioEl.value = sanitizeMoneyText(salarioEl.value);

  const salario = parseMoneyBR(salarioEl.value);
  const dependentes = Number(dependEl.value || 0);
  const usarSimp = !!simpEl.checked;

  // INSS
  const inss = calcINSSProgressivo(salario);

  // IRRF
  const { baseIrrf, irrf } = calcIRRF2026({
    salarioBruto: salario,
    inss,
    dependentes,
    usarDescontoSimplificado: usarSimp
  });

  // FGTS informativo (8%)
  const fgts = salario * 0.08;

  // Totais (venc = bruto; desc = INSS + IRRF; líquido = bruto - desc)
  const totalV = salario;
  const totalD = inss + irrf;
  const liquido = totalV - totalD;

  // Render
  vSalarioEl.textContent = money(salario);
  dInssEl.textContent    = money(inss);
  dIrrfEl.textContent    = money(irrf);

  totalVEl.textContent = money(totalV);
  totalDEl.textContent = money(totalD);
  liquidoEl.textContent = money(liquido);

  baseInssEl.textContent = money(salario);
  baseIrrfEl.textContent = money(baseIrrf);
  fgtsEl.textContent     = money(fgts);
}

["input", "change"].forEach(evt => {
  salarioEl.addEventListener(evt, recalc);
  dependEl.addEventListener(evt, recalc);
  simpEl.addEventListener(evt, recalc);
});

// Auto-format ao sair do campo salário
salarioEl.addEventListener("blur", () => {
  const v = parseMoneyBR(salarioEl.value);
  salarioEl.value = v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  recalc();
});

recalc();
