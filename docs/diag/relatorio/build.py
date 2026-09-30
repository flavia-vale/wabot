import html, collections
LOJA = {'shopee':'Shopee','shopee+shopee':'Shopee (2 links)','shein':'SHEIN','broadcast':'Outros'}
rows=[]
for line in open('dados.txt', encoding='utf-8'):
    line=line.rstrip('\n')
    if not line: continue
    parts=line.split('|')
    idx=next(i for i,p in enumerate(parts) if p in LOJA)
    rows.append(dict(hora=parts[0], grupo='|'.join(parts[1:idx]).strip(), loja=LOJA[parts[idx]], oferta='|'.join(parts[idx+1:]).strip()))
por_grupo=collections.OrderedDict()
for r in rows:
    g=por_grupo.setdefault(r['grupo'],{'n':0,'primeira':r['hora'],'ultima':r['hora']})
    g['n']+=1; g['ultima']=r['hora']
por_loja=collections.Counter(r['loja'].split(' ')[0] for r in rows)
dias=collections.OrderedDict()
for r in rows: dias.setdefault(r['hora'][:5],[]).append(r)
def esc(s): return html.escape(s)
kpis=''.join(f'<div class="kpi"><div class="kpi-n">{v["n"]}</div><div class="kpi-l">{esc(k)}</div><div class="kpi-s">{v["primeira"]} → {v["ultima"]}</div></div>' for k,v in por_grupo.items())
lojas=' · '.join(f'{k}: <b>{v}</b>' for k,v in por_loja.most_common())
tabelas=''
for dia,lst in dias.items():
    nome='29/09 (segunda-feira, das 15h em diante)' if dia=='29/09' else '30/09 (terça-feira, até 12h)'
    trs=''.join(f'<tr><td class="h">{esc(r["hora"][6:])}</td><td class="g">{esc(r["grupo"])}</td><td class="l"><span class="tag {r["loja"].split(" ")[0].lower()}">{esc(r["loja"])}</span></td><td class="o">{esc(r["oferta"])}</td></tr>' for r in lst)
    tabelas+=f'<h2>{esc(nome)} — {len(lst)} ofertas enviadas</h2><table><thead><tr><th>Hora</th><th>Grupo de destino</th><th>Loja</th><th>Oferta (início do texto enviado)</th></tr></thead><tbody>{trs}</tbody></table>'
page=f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de envios</title>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
:root{{--bg:#EEF6F2;--bg-soft:#DDEDE5;--surface:#FCFEFD;--ink:#1F2D2A;--ink-soft:#5A6E68;--ink-faint:#8FA09A;--accent:#7CC9A9;--accent-strong:#3E9C7A;--accent-2:#D9CFEA;--accent-3:#F6E8D8;--pro:#6F4FE8;--pro-soft:#ECE7FA;--warn:#E8A45A}}
@page{{size:A4;margin:14mm 12mm 16mm}}
*{{box-sizing:border-box}} body{{font-family:Figtree,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--ink);margin:0;font-size:10.5pt;line-height:1.35}}
.hero{{background:var(--bg);border-radius:14px;padding:18px 22px;margin-bottom:14px;border:1px solid var(--bg-soft)}}
.brand{{font-weight:800;color:var(--accent-strong);font-size:11pt;letter-spacing:.3px}} h1{{margin:4px 0 2px;font-size:20pt;font-weight:800}}
.sub{{color:var(--ink-soft);font-size:10pt}}
.kpis{{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}}
.kpi{{background:var(--surface);border:1px solid var(--bg-soft);border-radius:12px;padding:12px 14px;box-shadow:0 1px 2px rgba(31,45,42,.05)}}
.kpi-n{{font-size:24pt;font-weight:800;color:var(--accent-strong);line-height:1}} .kpi-l{{font-weight:600;margin-top:6px;font-size:9.5pt}} .kpi-s{{color:var(--ink-faint);font-size:8.5pt;margin-top:2px}}
.kpi.total .kpi-n{{color:var(--pro)}}
.box{{background:var(--surface);border:1px solid var(--bg-soft);border-radius:12px;padding:12px 16px;margin:10px 0}}
.box h3{{margin:0 0 6px;font-size:11pt}} .box ul{{margin:0;padding-left:18px}} .box li{{margin:3px 0}}
h2{{font-size:13pt;margin:18px 0 8px;color:var(--ink);border-left:4px solid var(--accent);padding-left:10px;page-break-after:avoid}}
table{{width:100%;border-collapse:collapse;font-size:9pt}} th{{text-align:left;background:var(--bg-soft);padding:6px 8px;font-size:8.5pt;text-transform:uppercase;letter-spacing:.4px;color:var(--ink-soft)}}
td{{padding:5px 8px;border-bottom:1px solid var(--bg-soft);vertical-align:top}} tr{{page-break-inside:avoid}} thead{{display:table-header-group}}
td.h{{white-space:nowrap;font-weight:700;width:48px}} td.g{{white-space:nowrap;width:190px}} td.l{{width:110px;white-space:nowrap}} td.o{{color:var(--ink)}}
.tag{{display:inline-block;padding:2px 8px;border-radius:999px;font-size:8pt;font-weight:600;background:var(--bg-soft);color:var(--ink-soft)}}
.tag.shopee{{background:#FDE8DC;color:#B4471D}} .tag.shein{{background:var(--accent-2);color:#4B34A8}} .tag.outros{{background:var(--accent-3);color:#8A5A1E}}
.foot{{margin-top:14px;color:var(--ink-faint);font-size:8.5pt}}
</style></head><body>
<div class="hero"><div class="brand">ESPELHA GRUPOS</div><h1>Relatório de envios do espelhamento</h1>
<div class="sub">Conta: <b>promosdaella@gmail.com</b> · Período: <b>29/09/2026 15:00 → 30/09/2026 12:01</b> (horário de Brasília) · Fonte: registro de envios do robô</div></div>
<div class="kpis"><div class="kpi total"><div class="kpi-n">{len(rows)}</div><div class="kpi-l">ofertas enviadas</div><div class="kpi-s">em {len(por_grupo)} grupos de destino</div></div>{kpis}</div>
<div class="box"><h3>Por loja</h3>{lojas}</div>
<div class="box"><h3>Como ler o ritmo de envio</h3><ul>
<li>Sua configuração de proteção da conta (perfil <b>Devagar</b>) é <b>1 oferta a cada 9 minutos por grupo</b> e envio só <b>das 8h às 22h</b>. Por isso os horários da tabela aparecem espaçados de ~9 a 11 minutos dentro de cada grupo — é o intervalo que você escolheu, não uma falha.</li>
<li>Entre 22h e 8h o robô guarda as ofertas e retoma às 8h (veja os envios de 30/09 começando às 08:00).</li>
<li>Se quiser mais ofertas por hora, basta reduzir o intervalo mínimo no Anti-banimento (ex.: 5 min = até 12 por hora em cada grupo).</li>
<li>Ofertas automáticas (busca Shopee) estão com <b>intervalo de 45 min</b> e <b>1 oferta por envio</b> — dá para ajustar na tela de Ofertas automáticas.</li>
</ul></div>
{tabelas}
<div class="foot">Relatório gerado em 30/09/2026 a partir do registro de envios com status "enviado". Horários convertidos para o fuso de Brasília.</div>
</body></html>'''
open('relatorio-envios-promosdaella.html','w',encoding='utf-8').write(page)
print(len(rows), dict(por_loja), {k:v['n'] for k,v in por_grupo.items()})
