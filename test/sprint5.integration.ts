import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/lib/prisma.js';
import { env } from '../src/config/env.js';
import { signToken } from '../src/utils/jwt.js';

test('Sprint 5: autenticação, isolamento, aportes simultâneos, datas e relatório real', async () => {
  const databaseHost = new URL(env.DATABASE_URL).hostname;
  assert.ok(['localhost','127.0.0.1','[::1]'].includes(databaseHost), 'Os testes de integração usam somente banco local.');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port + '/api';
  const ids: number[] = [];
  let sharedCategory: number | undefined;
  async function request(method: string, route: string, body?: unknown, token?: string) {
    const response = await fetch(base + route, { method, headers: { 'Content-Type':'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json().catch(() => null) };
  }
  try {
    const suffix = randomUUID();
    for (const name of ['A','B']) {
      const registered = await request('POST','/users/register',{fullName:'Sprint ' + name,email:'sprint-' + name + '-' + suffix + '@example.com',password:'TesteSprint5!123'});
      assert.equal(registered.status,201,JSON.stringify(registered.data)); ids.push(registered.data.id_usuario);
    }
    const userA=ids[0]!, userB=ids[1]!; const tokenA=signToken({userId:userA}), tokenB=signToken({userId:userB});
    const login=await request('POST','/auth/login',{email:'sprint-A-' + suffix + '@example.com',password:'TesteSprint5!123'});assert.equal(login.status,200);assert.ok(login.data.token);
    assert.equal((await request('GET','/goals')).status,401);
    const income = await request('POST','/categories',{nome:'Receita de teste',tipo:'receita'},tokenA);assert.equal(income.status,201);assert.equal(income.data.editavel,true);
    const expense = await request('POST','/categories',{nome:'Despesa de teste',tipo:'despesa'},tokenA);assert.equal(expense.status,201);
    const categoryId=income.data.id_categoria, expenseId=expense.data.id_categoria;
    assert.equal((await request('GET','/categories',undefined,tokenB)).data.some((item: {id_categoria:number})=>item.id_categoria===categoryId),false);
    assert.equal((await request('PUT','/categories/'+categoryId,{nome:'Alterada'},tokenB)).status,404);
    assert.equal((await request('DELETE','/categories/'+categoryId,undefined,tokenB)).status,404);
    const shared=await prisma.categorias.create({data:{nome:'Compartilhada '+suffix.slice(0,8),tipo:'receita'}});sharedCategory=shared.id_categoria;
    assert.equal((await request('PUT','/categories/'+sharedCategory,{nome:'Alterada'},tokenA)).status,403);
    assert.equal((await request('DELETE','/categories/'+sharedCategory,undefined,tokenA)).status,403);
    const created=await request('POST','/goals',{titulo:'Reserva de teste',valor_objetivo:100,descricao:'Descrição inicial',data_fim:'2026-10-25'},tokenA);assert.equal(created.status,201);
    const goalId=created.data.id_meta;
    assert.equal((await request('POST','/goals/'+goalId+'/contribute',{valor:10},tokenB)).status,404);
    assert.equal((await request('POST','/goals/'+goalId+'/contribute',{valor:0.001},tokenA)).status,400);
    const deposits=await Promise.all([0.1,0.2,10,20,30,39.7].map((valor)=>request('POST','/goals/'+goalId+'/contribute',{valor},tokenA)));
    assert.ok(deposits.every((item)=>item.status===200),JSON.stringify(deposits));
    const goal=await request('GET','/goals/'+goalId,undefined,tokenA);assert.equal(goal.data.valor_atual,100);assert.equal(goal.data.status,'concluida');
    const reopened=await request('PUT','/goals/'+goalId,{valor_objetivo:150,descricao:null,data_fim:null},tokenA);assert.equal(reopened.status,200);assert.equal(reopened.data.status,'em_andamento');assert.equal(reopened.data.data_fim,null);assert.equal(reopened.data.descricao,null);
    assert.equal((await request('PUT','/goals/'+goalId,{status:'concluida'},tokenA)).status,400);
    assert.equal((await request('POST','/goals',{titulo:'Inválida',valor_objetivo:10,data_fim:'2026-02-30'},tokenA)).status,400);
    assert.equal((await request('PUT','/goals/'+goalId,{data_inicio:'2026-10-25',data_fim:'2026-10-05'},tokenA)).status,400);
    await request('PUT','/goals/'+goalId,{status:'cancelada'},tokenA);
    assert.equal((await request('POST','/goals/'+goalId+'/contribute',{valor:10},tokenA)).status,400);
    const createTx=(valor:number,tipo:'receita'|'despesa',date:string,token=tokenA,status='confirmada')=>request('POST','/transactions',{valor,tipo,data_transacao:date,id_categoria:tipo==='receita'?categoryId:expenseId,descricao:'Movimentação Sprint 5',status},token);
    assert.equal((await createTx(10,'receita','2026-10-05',tokenB)).status,404);
    assert.equal((await request('POST','/transactions',{valor:10,tipo:'despesa',data_transacao:'2026-10-05',id_categoria:categoryId,descricao:'Tipo incorreto'},tokenA)).status,400);
    assert.equal((await createTx(500,'receita','2026-09-01')).status,201);
    assert.equal((await createTx(250,'despesa','2026-09-30')).status,201);
    const t1=await createTx(1000,'receita','2026-10-01');assert.equal(t1.status,201);
    const t2=await createTx(150.25,'despesa','2026-10-31');assert.equal(t2.status,201);
    assert.equal((await createTx(99999,'despesa','2026-10-06',tokenA,'pendente')).status,201);
    assert.equal((await createTx(2,'despesa','2026-11-01')).status,201);
    assert.equal((await request('PUT','/transactions/'+t1.data.id_transacao,{tipo:'despesa'},tokenA)).status,400);
    assert.equal((await request('DELETE','/transactions/'+t1.data.id_transacao,undefined,tokenB)).status,404);
    assert.equal((await request('DELETE','/categories/'+categoryId,undefined,tokenA)).status,409);
    const report=await request('GET','/reports/detailed?data_inicio=2026-10-01&data_fim=2026-10-31',undefined,tokenA);assert.equal(report.status,200,JSON.stringify(report.data));
    assert.equal(report.data.summary.receitas,1000);assert.equal(report.data.summary.despesas,150.25);assert.equal(report.data.summary.saldo,849.75);assert.equal(report.data.transactions.length,2);assert.equal(report.data.evolution.length,1);assert.equal(report.data.categoryBreakdown[0].total,150.25);
    assert.equal((await request('GET','/reports/detailed?data_inicio=2026-10-01&data_fim=2026-10-31',undefined,tokenB)).data.transactions.length,0);
    const single=await request('GET','/reports/detailed?data_inicio=2026-10-31&data_fim=2026-10-31',undefined,tokenA);assert.equal(single.data.summary.despesas,150.25);assert.equal(single.data.summary.saldo,-150.25);
    assert.equal((await request('GET','/reports/detailed?data_inicio=2026-10-25&data_fim=2026-10-05',undefined,tokenA)).status,400);
    assert.equal((await request('GET','/reports/detailed?data_inicio=2026-02-30&data_fim=2026-10-05',undefined,tokenA)).status,400);
    assert.equal((await request('GET','/reports/detailed?data_inicio=2026-10-01&data_fim=2026-10-31')).status,401);
    const filtered=await request('GET','/transactions?data_inicio=2026-10-31&data_fim=2026-10-31',undefined,tokenA);assert.equal(filtered.data.length,1);
    const monthly=await request('GET','/reports/monthly?ano=2026',undefined,tokenA);assert.equal(monthly.data[9].saldo,849.75);
    const dashboard=await request('GET','/dashboard',undefined,tokenA);assert.equal(dashboard.status,200);
    // Cleanup of our own resources also exercises successful delete routes.
    for (const transaction of (await request('GET','/transactions',undefined,tokenA)).data) assert.equal((await request('DELETE','/transactions/'+transaction.id_transacao,undefined,tokenA)).status,204);
    assert.equal((await request('DELETE','/categories/'+categoryId,undefined,tokenA)).status,204);
    assert.equal((await request('DELETE','/goals/'+goalId,undefined,tokenA)).status,204);
  } finally {
    if (ids.length) {
      await prisma.transacoes.deleteMany({where:{id_usuario:{in:ids}}});
      await prisma.metas_financeiras.deleteMany({where:{id_usuario:{in:ids}}});
      await prisma.categorias.deleteMany({where:{id_usuario:{in:ids}}});
      await prisma.usuarios.deleteMany({where:{id_usuario:{in:ids}}});
    }
    if (sharedCategory !== undefined) await prisma.categorias.deleteMany({where:{id_categoria:sharedCategory}});
    await new Promise<void>((resolve,reject)=>server.close((error)=>error?reject(error):resolve()));await prisma.$disconnect();
  }
});
