/**
 * =============================================================================
 * 【测试 5】Qdrant 向量库状态检查
 * =============================================================================
 * 
 * 【文件作用】
 *   检查 Qdrant 向量数据库的运行状态和存储的数据
 * 
 * 【为什么被创建】
 *   项目引入 Qdrant 作为持久化向量库后
 *   需要确认：容器是否运行、集合是否存在、数据是否正确存储
 * 
 * 【使用方法】
 *   npx tsx test/5.qdrant-check.ts
 * 
 * 【测试内容】
 *   1. 检查集合是否存在、状态是否健康
 *   2. 统计数据总量
 *   3. 读取存储的文档内容
 *   4. 测试搜索功能（用问题查询相似文档）
 */

import dotenv from "dotenv";
dotenv.config();

const QDRANT_URL = "http://localhost:6333";
const COLLECTION_NAME = "company_docs";

async function check() {
  console.log("🔍 检查 Qdrant 向量库\n");

  // 1. 检查集合
  console.log("=== 步骤 1: 集合信息 ===");
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    const data = await res.json();
    if (data.result) {
      console.log(`✅ 集合存在`);
      console.log(`   状态: ${data.result.status}`);
      console.log(`   向量维度: ${data.result.config.params.vectors.size}`);
      console.log(`   距离度量: ${data.result.config.params.vectors.distance}`);
    } else {
      console.log(`❌ 集合不存在`);
    }
  } catch (e) {
    console.log(`❌ Qdrant 连接失败: ${(e as Error).message}`);
    console.log(`   提示: 请确保 Docker 容器正在运行 (docker ps)`);
  }

  // 2. 统计数据量
  console.log("\n=== 步骤 2: 数据统计 ===");
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/count`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    console.log(`✅ 记录总数: ${data.result?.count || 0}`);
  } catch (e) {
    console.log(`❌ 统计失败: ${(e as Error).message}`);
  }

  // 3. 读取数据内容
  console.log("\n=== 步骤 3: 数据内容 ===");
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 1000, with_payload: true, with_vector: false }),
    });
    const data = await res.json();
    const points = data.result?.points || [];
    console.log(`✅ 共有 ${points.length} 条记录`);
    points.forEach((p: any, i: number) => {
      console.log(`\n--- 记录 ${i + 1} ---`);
      console.log(`ID: ${p.id}`);
      console.log(`文本: ${p.payload?.text?.substring(0, 150)}...`);
    });
  } catch (e) {
    console.log(`❌ 读取失败: ${(e as Error).message}`);
  }

  // 4. 搜索测试
  console.log("\n=== 步骤 4: 搜索测试 ===");
  try {
    const question = "年假";
    const embedRes = await fetch("https://open.bigmodel.cn/api/paas/v4/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ZHIPU_API_KEY || ""}`,
      },
      body: JSON.stringify({ model: "embedding-2", input: question }),
    });
    const embedData = await embedRes.json();
    const queryVector = embedData.data?.[0]?.embedding;

    if (queryVector) {
      const searchRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vector: queryVector, limit: 3, with_payload: true }),
      });
      const searchData = await searchRes.json();
      console.log(`搜索 "${question}" 找到 ${(searchData.result || []).length} 条结果`);
      (searchData.result || []).forEach((hit: any, i: number) => {
        console.log(`   [${i + 1}] 相似度: ${hit.score.toFixed(4)}`);
        console.log(`       ${hit.payload?.text?.substring(0, 80)}...`);
      });
    }
  } catch (e) {
    console.log(`❌ 搜索失败: ${(e as Error).message}`);
  }

  console.log("\n✅ 检查完成");
}

check().catch(console.error);
