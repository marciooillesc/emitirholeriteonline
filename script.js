const rowsEl = document.getElementById("rows");
const rowTemplate = document.getElementById("rowTemplate");

const totalVencEl = document.getElementById("totalVencimentos");
const totalDescEl = document.getElementById("totalDescontos");
const liquidoEl  = document.getElementById("liquidoReceber");

const baseSalarioEl = document.getElementById("baseSalario");
const baseFgtsEl    = document.getElementById("baseFgts");
const fgtsMesEl     = document.getElementById("fgtsMes");
const baseInssEl    = document.getElementById("baseInss");
const baseIrrfEl    = document.getElementById("baseIrrf");

document.getElementById("btnAddEarning").addEventListener("click", () => addRow({ earning: true }));
document.getElementById("btnAddDeduction").addEventListener("click", () => addRow({ deduction: true }));
document.getElementById("btnPrint").addEventListener("click", () => window.print());
document.getElementById("btnClear").addEventListener("click", clearAll);

function addRow({ earning = false, deduction = false, preset = {} } = {}) {
  const node = rowTemplate.content.cloneNode(true);
  const row = node.querySelector(".row");

  const desc = row.querySelector(".desc");
  const ref  = row.querySelector(".ref");
  const earn = row.querySelector(".earning");
  const ded  = row.querySelector(".deduction");
  const btnR = row.querySelector("button");

  desc.value = preset.desc ?? "";
  ref.value  = preset.ref ?? "";
  earn.value = preset.earning ?? "";
  ded.value  = preset.deduction ?? "";

  if (earning && !preset.earning) earn.focus();
  if (deduction && !preset.deduction) ded.focus();

  // Formatação e recálculo
  [earn, ded].forEach((inp) => {
    inp.addEventListener("input", () => {
      // mantém apenas números e separadores
      inp.value = sanitizeMoneyText(inp.value);
      recalc();
    });
    inp.addEventListener("blur", () => {
      inp.value = formatMoneyBR(parseMoneyBR(inp.value));
      recalc();
    });
  });

  [desc, ref].forEach((inp) => inp.addEventListener("input", recalc));

  btnR.addEventListener("click", () => {
    row.remove();
    recalc();
  });

  rowsEl.appendChild(node);
  recalc();
}

// Money helpers (pt-BR)
function sanitizeMoneyText(v){
  // aceita dígitos, ponto e vírgula e sinal
  v = String(v ?? "");
  v = v.replace(/[^\d,.\-]/g, "");
  // se tiver mais de um sinal -, mantém só o primeiro
  v = v.replace(/(?!^)-/g, "");
  return v;
}

function parseMoneyBR(v){
  if (!v) return 0;
  v = String(v).trim();

  // Remove R$ e espaços
  v = v.replace(/R\$\s?/g, "").replace(/\s/g, "");

  // Heurística:
  // - Se tem vírgula, assume que é decimal e remove pontos de milhar
  // - Se não tem vírgula, tenta usar ponto como decimal se houver
  if (v.includes(",")) {
    v = v.replace(/\./g, "");
    v = v.replace(",", ".");
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatMoneyBR(n){
  return (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function recalc(){
  const rowList = Array.from(rowsEl.querySelectorAll(".row"));
  let totalE = 0;
  let totalD = 0;

  // “Salário Base” (pega o primeiro item com descrição igual, se existir)
  let salarioBase = 0;

  rowList.forEach((r) => {
    const desc = r.querySelector(".desc")?.value?.trim()?.toLowerCase() || "";
    const e = parseMoneyBR(r.querySelector(".earning")?.value);
    const d = parseMoneyBR(r.querySelector(".deduction")?.value);

    totalE += e;
    totalD += d;

    if (!salarioBase && desc === "salário base") {
      salarioBase = e;
    }
  });

  const liquido = totalE - totalD;

  totalVencEl.textContent = formatMoneyBR(totalE);
  totalDescEl.textContent = formatMoneyBR(totalD);
  liquidoEl.textContent   = formatMoneyBR(liquido);

  // Bases (simples e úteis)
  // Você pode ajustar conforme sua regra: aqui usamos:
  // - Base INSS/IRRF = Total Vencimentos (padrão)
  // - Base FGTS = Salário Base (se tiver), senão Total Vencimentos
  const baseInss = totalE;
  const baseIrrf = totalE;
  const baseFgts = salarioBase > 0 ? salarioBase : totalE;
  const fgtsMes  = baseFgts * 0.08;

  baseSalarioEl.textContent = formatMoneyBR(salarioBase);
  baseFgtsEl.textContent    = formatMoneyBR(baseFgts);
  fgtsMesEl.textContent     = formatMoneyBR(fgtsMes);
  baseInssEl.textContent    = formatMoneyBR(baseInss);
  baseIrrfEl.textContent    = formatMoneyBR(baseIrrf);
}

function clearAll(){
  if (!confirm("Limpar todos os campos e linhas?")) return;
  // Limpa inputs gerais
  document.querySelectorAll("input, textarea").forEach((el) => {
    if (el.type === "month" || el.type === "date" || el.type === "text") el.value = "";
    if (el.tagName === "TEXTAREA") el.value = "";
  });
  // Limpa linhas
  rowsEl.innerHTML = "";
  // Recria linhas padrão
  seedDefaultRows();
  recalc();
}

function seedDefaultRows(){
  addRow({ preset: { desc:"Salário Base", ref:"", earning:"0,00", deduction:"" }});
  addRow({ preset: { desc:"INSS", ref:"", earning:"", deduction:"0,00" }});
  addRow({ preset: { desc:"IRRF", ref:"", earning:"", deduction:"0,00" }});
  // + algumas linhas vazias
  for (let i=0; i<6; i++) addRow();
}

// inicial
seedDefaultRows();
recalc();
