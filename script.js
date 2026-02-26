const f = v => v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const salarioEl = document.getElementById("salario");
const simpEl = document.getElementById("simp");

function calc(){
  let s = parseFloat(salarioEl.value.replace(",","."))||0;
  let inss = Math.min(s*0.11,908.85);
  let base = simpEl.checked ? s-607.2 : s-inss;
  base = Math.max(0,base);
  let irrf = base<=2428.8?0:base*0.075-182.16;
  irrf = Math.max(0,irrf);
  let fgts = s*0.08;

  document.getElementById("vSalario").innerText=f(s);
  document.getElementById("dInss").innerText=f(inss);
  document.getElementById("dIrrf").innerText=f(irrf);
  document.getElementById("totalV").innerText=f(s);
  document.getElementById("totalD").innerText=f(inss+irrf);
  document.getElementById("liquido").innerText=f(s-inss-irrf);
  document.getElementById("fgts").innerText=f(fgts);
}
salarioEl.oninput=calc;
simpEl.onchange=calc;

// LOGO
document.getElementById("empresaLogo").onchange=e=>{
  const r=new FileReader();
  r.onload=()=>{logoPreview.src=r.result;logoPreview.style.display="block"}
  r.readAsDataURL(e.target.files[0]);
};

// CNPJ → Empresa
empresaCnpj.onblur=async()=>{
  const c=empresaCnpj.value.replace(/\D/g,"");
  if(c.length!=14)return;
  const u=`https://api.allorigins.win/raw?url=${encodeURIComponent("https://brasilapi.com.br/api/cnpj/v1/"+c)}`;
  const j=await fetch(u).then(r=>r.json()).catch(()=>null);
  if(!j)return;
  empresaNome.value=j.razao_social||"";
  empresaEndereco.value=`${j.logradouro||""}, ${j.numero||""} - ${j.municipio||""}/${j.uf||""}`;
};
