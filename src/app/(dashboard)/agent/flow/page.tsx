"use client";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";

// ── Types ──
type NodeType = "trigger" | "agent" | "action" | "branch" | "end";
type NodeData = {
  id: string;
  type: NodeType;
  label: string;
  desc: string;
  x: number;
  y: number;
  color: string;
  phase?: string;
  tplKey?: string;
  branchTargets?: string[];
  icon?: string;
};
type Edge = { from: string; to: string; label?: string; color?: string };

// ── Template DB ──
const TEMPLATES: Record<string, { title: string; text: string }> = {
  tpl_1st: { title: "1st\u30E1\u30FC\u30EB\u751F\u6210", text: "\u25A0 \u304A\u554F\u3044\u5408\u308F\u305B\u3044\u305F\u3060\u3044\u305F\u7269\u4EF6\n\u30FB{{property_name}}\n{{property_url}}\n\n\u21D2\u3054\u7D39\u4ECB\u53EF\u80FD\u306A\u304A\u90E8\u5C4B\u3067\u3059\u3002\n\u6B63\u78BA\u306A\u898B\u5B66\u53EF\u80FD\u65E5\u6642\u306B\u95A2\u3057\u3066\u306F\u78BA\u8A8D\u304C\u5FC5\u8981\u2026\n\n{VISIT_PROPOSAL}\u306F\u3054\u90FD\u5408\u3044\u304B\u304C\u3067\u3057\u3087\u3046\u304B\uFF1F" },
  tpl_tent_a: { title: "\u3010\u672A\u78BA\u5B9Aa\u3011\u5165\u5C45\u4E2D\uFF08\u898B\u308C\u306A\u3044\uFF09", text: "{{customer_name}}\u69D8\n\n\u3054\u9023\u7D61\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\n\n================================================\n\u203B\u73FE\u6642\u70B9\u3067\u3054\u4E88\u7D04\u306F\u78BA\u5B9A\u3057\u3066\u304A\u308A\u307E\u305B\u3093\u306E\u3067\u3001\u3054\u6CE8\u610F\u304F\u3060\u3055\u3044\n================================================\n\n\u304A\u554F\u3044\u5408\u308F\u305B\u7269\u4EF6\u306F\u73FE\u5728\u306F\u5165\u5C45\u4E2D\u3068\u306A\u3063\u3066\u304A\u308A\u3001\u307E\u3060\u5185\u898B\u306E\u3067\u304D\u306A\u3044\u304A\u90E8\u5C4B\u3067\u3059\u306E\u3067\u3001\n\u8857\u4E26\u307F\u30FB\u5916\u89B3\u30FB\u5171\u7528\u90E8\u306E\u3054\u6848\u5185\u3084\u30A8\u30EA\u30A2\u60C5\u5831\u306E\u7D39\u4ECB\u3001\u4F3C\u3066\u3044\u308B\u7269\u4EF6\u306E\u3054\u7D39\u4ECB\u304C\u3067\u304D\u308C\u3070\u3068\u601D\u3044\u307E\u3059\u3002\n\n{visit_proposal}\u306B\u4E0B\u8A18\u306E\u5E97\u8217\u306B\u3066\u3054\u4E88\u7D04\u3067\u304D\u308C\u3070\u3068\u601D\u3046\u306E\u3067\u3059\u304C\u3001\n\u3010\u304A\u96FB\u8A71\u756A\u53F7\u3011\u3092\u9802\u304F\u3053\u3068\u53EF\u80FD\u3067\u3057\u3087\u3046\u304B\uFF1F\n\n{store_access}" },
  tpl_tent_b: { title: "\u3010\u672A\u78BA\u5B9Ab\u3011\u52DF\u96C6\u7D42\u4E86", text: "{{customer_name}}\u69D8\n\n\u3054\u9023\u7D61\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\n\n================================================\n\u203B\u73FE\u6642\u70B9\u3067\u3054\u4E88\u7D04\u306F\u78BA\u5B9A\u3057\u3066\u304A\u308A\u307E\u305B\u3093\u306E\u3067\u3001\u3054\u6CE8\u610F\u304F\u3060\u3055\u3044\n================================================\n\n\u304A\u554F\u3044\u5408\u308F\u305B\u7269\u4EF6\u306F\u73FE\u5728\u306F\u52DF\u96C6\u304C\u7D42\u4E86\u3057\u3066\u304A\u308A\u307E\u3059\u306E\u3067\u3001\n\u305C\u3072\u4E00\u5EA6\u5E97\u982D\u3067\u8A73\u3057\u3044\u304A\u8A71\u3092\u4F3A\u3063\u305F\u4E0A\u3067\u3001\n\u3053\u306E\u4ED6\u306B\u3082\u304A\u90E8\u5C4B\u306E\u3054\u7D39\u4ECB\u304C\u3067\u304D\u308C\u3070\u3068\u601D\u3044\u307E\u3059\u3002\n\n{visit_proposal}\u306B\u4E0B\u8A18\u306E\u5E97\u8217\u306B\u3066\u3054\u4E88\u7D04\u3067\u304D\u308C\u3070\u3068\u601D\u3046\u306E\u3067\u3059\u304C\u3001\n\u3010\u304A\u96FB\u8A71\u756A\u53F7\u3011\u3092\u9802\u304F\u3053\u3068\u53EF\u80FD\u3067\u3057\u3087\u3046\u304B\uFF1F\n\n{store_access}" },
  tpl_tent_c: { title: "\u3010\u672A\u78BA\u5B9Ac\u3011\u898B\u308C\u308B\uFF08\u52DF\u96C6\u4E2D\uFF09", text: "{{customer_name}}\u69D8\n\n\u3054\u9023\u7D61\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\n\n================================================\n\u203B\u73FE\u6642\u70B9\u3067\u3054\u4E88\u7D04\u306F\u78BA\u5B9A\u3057\u3066\u304A\u308A\u307E\u305B\u3093\u306E\u3067\u3001\u3054\u6CE8\u610F\u304F\u3060\u3055\u3044\n================================================\n\n\u5F53\u65E5\u306F\u4E00\u5EA6\u5E97\u982D\u3067\u8A73\u3057\u3044\u304A\u8A71\u3092\u4F3A\u3063\u305F\u4E0A\u3067\u3001\u3044\u304F\u3064\u304B\u7269\u4EF6\u3092\u7D39\u4ECB\u3044\u305F\u3057\u307E\u3059\u3002\n\u304A\u554F\u3044\u5408\u308F\u305B\u306E\u7269\u4EF6\u306B\u52A0\u3048\u3066\u3001\u5019\u88DC\u7269\u4EF6\u3092\u6D17\u3044\u51FA\u3057\u305F\u4E0A\u3067\u3001\n\u4E00\u6C17\u306B\u56DE\u308B\u6D41\u308C\u3067\u3054\u6848\u5185\u3067\u304D\u308C\u3070\u3068\u601D\u3044\u307E\u3059\u3002\n\n{visit_proposal}\u306B\u4E0B\u8A18\u306E\u5E97\u8217\u306B\u3066\u3054\u4E88\u7D04\u3067\u304D\u308C\u3070\u3068\u601D\u3046\u306E\u3067\u3059\u304C\u3001\n\u3010\u304A\u96FB\u8A71\u756A\u53F7\u3011\u3092\u9802\u304F\u3053\u3068\u53EF\u80FD\u3067\u3057\u3087\u3046\u304B\uFF1F\n\n{store_access}" },
  tpl_tent_d: { title: "\u3010\u672A\u78BA\u5B9Ad\u3011\u5EFA\u7BC9\u4E2D\uFF08\u898B\u308C\u306A\u3044\uFF09", text: "{{customer_name}}\u69D8\n\n\u3054\u9023\u7D61\u3042\u308A\u304C\u3068\u3046\u3054\u3056\u3044\u307E\u3059\u3002\n\n================================================\n\u203B\u73FE\u6642\u70B9\u3067\u3054\u4E88\u7D04\u306F\u78BA\u5B9A\u3057\u3066\u304A\u308A\u307E\u305B\u3093\u306E\u3067\u3001\u3054\u6CE8\u610F\u304F\u3060\u3055\u3044\n================================================\n\n\u304A\u554F\u3044\u5408\u308F\u305B\u7269\u4EF6\u306F\u73FE\u5728\u306F\u5EFA\u7BC9\u4E2D\u3068\u306A\u3063\u3066\u304A\u308A\u3001\u307E\u3060\u5185\u898B\u306E\u3067\u304D\u306A\u3044\u304A\u90E8\u5C4B\u3067\u3059\u306E\u3067\u3001\n\u8857\u4E26\u307F\u30FB\u73FE\u72B6\u306E\u5916\u89B3\u306E\u3054\u6848\u5185\u3084\u30A8\u30EA\u30A2\u60C5\u5831\u306E\u7D39\u4ECB\u3001\u4F3C\u3066\u3044\u308B\u7269\u4EF6\u306E\u3054\u7D39\u4ECB\u304C\u3067\u304D\u308C\u3070\u3068\u601D\u3044\u307E\u3059\u3002\n\n{visit_proposal}\u306B\u4E0B\u8A18\u306E\u5E97\u8217\u306B\u3066\u3054\u4E88\u7D04\u3067\u304D\u308C\u3070\u3068\u601D\u3046\u306E\u3067\u3059\u304C\u3001\n\u3010\u304A\u96FB\u8A71\u756A\u53F7\u3011\u3092\u9802\u304F\u3053\u3068\u53EF\u80FD\u3067\u3057\u3087\u3046\u304B\uFF1F\n\n{store_access}" },
  tpl_confirm: { title: "\u3010\u30A2\u30DD\u78BA\u5B9A\u3011\u2605\u30A2\u30DD\u7528_\u6765\u5E97", text: "\u305D\u308C\u3067\u306F{appointment_datetime}\u306B\u4E0B\u8A18\u306E\u5E97\u8217\u306B\u3054\u4E88\u7D04\u3044\u305F\u3057\u307E\u3059\u3002\n\n{store_access}\n\n\u307E\u305F\u3001\u6765\u5E97\u6642\u306E\u3054\u6848\u5185\u306B\u969B\u3057\u3066\n\n\u3010\u304A\u96FB\u8A71\u756A\u53F7\u3011\u3068\u4E0B\u8A18\u3010\u5E0C\u671B\u6761\u4EF6\u3011\u3092\u304A\u77E5\u3089\u305B\u304F\u3060\u3055\u3044\u3002\n\n----------------------------------------------\n\n\u25A0\u5E0C\u671B\u6761\u4EF6\n\n\u30FB\u8CC3\u6599\uFF1A\uFF08\u3000\u3000\uFF09\u5186\u307E\u3067\n\u30FB\u9593\u53D6\uFF1A\uFF08\u3000\u3000\uFF09\n\u30FB\u5E83\u3055\uFF1A\uFF08\u3000\u3000\uFF09\u33A1\u4EE5\u4E0A\n\u30FB\u99D0\u8ECA\u5834\uFF08\u3000\u3000\uFF09\u53F0\u5E0C\u671B\n\u30FB\u30A8\u30EA\u30A2\uFF1A\uFF08\u3000\u3000\uFF09\n\u30FB\u99C5\u304B\u3089\uFF1A\uFF08\u3000\u3000\uFF09\u5206\n\u30FB\u5165\u5C45\u4EBA\u6570\uFF1A\uFF08\u3000\u3000\uFF09\u4EBA\n\u30FB\u5165\u5C45\u5E0C\u671B\u6642\u671F\uFF1A\uFF08\u3000\u5E74\u3000\u6708\u3000\u65E5\u9803\uFF09\n\u30FB\u5F15\u3063\u8D8A\u3057\u7406\u7531\uFF08\u3000\u3000\uFF09\n\u30FB\u305D\u306E\u4ED6\u3001\u3053\u3060\u308F\u308A\u6761\u4EF6\uFF08\u3000\u3000\uFF09" },
  tpl_b_time: { title: "B\u5C64: \u5F15\u8D8A\u3057\u6642\u671F\u78BA\u8A8D", text: "\u304A\u5F15\u8D8A\u3057\u306E\u6642\u671F\u306F\u3044\u3064\u9803\u3092\u3054\u4E88\u5B9A\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F\n\n\u6642\u671F\u306B\u5408\u308F\u305B\u3066\u6700\u9069\u306A\u304A\u90E8\u5C4B\u63A2\u3057\u306E\u9032\u3081\u65B9\u3092\u3054\u6848\u5185\u3044\u305F\u3057\u307E\u3059\u3002" },
  tpl_b_push: { title: "B\u5C64: \u6765\u5E97\u3059\u3079\u304D\u3068\u8A00\u3044\u5207\u308B", text: "\u3054\u5165\u5C45\u304C2\u30F6\u6708\u4EE5\u5185\u3068\u3044\u3046\u3053\u3068\u3067\u3042\u308C\u3070\u3001\n\u7269\u4EF6\u306E\u52D5\u304D\u304C\u975E\u5E38\u306B\u65E9\u3044\u6642\u671F\u3067\u3059\u306E\u3067\u3001\n\u305C\u3072\u4E00\u5EA6\u3054\u6765\u5E97\u3044\u305F\u3060\u304D\u3001\u6700\u65B0\u306E\u7269\u4EF6\u60C5\u5831\u3092\n\u3054\u78BA\u8A8D\u3044\u305F\u3060\u304F\u3053\u3068\u3092\u5F37\u304F\u304A\u3059\u3059\u3081\u3044\u305F\u3057\u307E\u3059\u3002" },
  tpl_fu1: { title: "\u8FFD\u5BA2\u2460\u5F53\u65E5", text: "\u4EBA\u6C17\u30A8\u30EA\u30A2\u306F\u7269\u4EF6\u306E\u52D5\u304D\u304C\u975E\u5E38\u306B\u65E9\u304F\u3001\u6570\u65E5\u3067\u57CB\u307E\u308B\u30B1\u30FC\u30B9\u304C\u3054\u3056\u3044\u307E\u3059\u3002\n\u304A\u65E9\u3081\u306B\u3054\u6765\u5E97\u3044\u305F\u3060\u304D\u3001\u6700\u65B0\u306E\u7269\u4EF6\u60C5\u5831\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u307E\u305B\u3002" },
  tpl_fu2: { title: "\u8FFD\u5BA2\u2461\u7FCC\u65E5", text: "\u3054\u5E0C\u671B\u306E\u30A8\u30EA\u30A2\u3084\u6CBF\u7DDA\u3001\u5BB6\u8CC3\u306E\u4E0A\u9650\u3001\u9593\u53D6\u308A\u3001\u3053\u3060\u308F\u308A\u6761\u4EF6\u304C\u3042\u308C\u3070\u304A\u6559\u3048\u304F\u3060\u3055\u3044\u307E\u305B\u3002" },
  tpl_fu3: { title: "\u8FFD\u5BA2\u24622\u65E5\u5F8C", text: "\u4EBA\u6C17\u7269\u4EF6\u306F\u516C\u958B\u304B\u3089\u6570\u65E5\u3067\u7533\u8FBC\u304C\u5165\u3063\u3066\u3057\u307E\u3046\u30B1\u30FC\u30B9\u304C\u5897\u3048\u3066\u304A\u308A\u307E\u3059\u3002\u6700\u65B0\u306E\u7A7A\u5BA4\u72B6\u6CC1\u3092\u3054\u78BA\u8A8D\u304F\u3060\u3055\u3044\u3002" },
  tpl_fu4: { title: "\u8FFD\u5BA2\u24635\u65E5\u5F8C", text: "\u65B0\u7740\u7269\u4EF6\u3084\u30CD\u30C3\u30C8\u975E\u63B2\u8F09\u306E\u7269\u4EF6\u3082\u3054\u3056\u3044\u307E\u3059\u306E\u3067\u3001\u305C\u3072\u4E00\u5EA6\u3054\u6765\u5E97\u304F\u3060\u3055\u3044\u307E\u305B\u3002" },
  tpl_fu5: { title: "\u8FFD\u5BA2\u246410\u65E5\u5F8C", text: "\u304A\u5F15\u8D8A\u3057\u6642\u671F\u306F\u3044\u3064\u9803\u3092\u3054\u4E88\u5B9A\u3055\u308C\u3066\u3044\u307E\u3059\u304B\uFF1F\n\u3044\u3064\u3067\u3082\u304A\u6C17\u8EFD\u306B\u3054\u9023\u7D61\u304F\u3060\u3055\u3044\u307E\u305B\u3002" },
  tpl_slot: { title: "\u65E5\u7A0B\u63D0\u793A", text: "\u4EE5\u4E0B\u306E\u65E5\u7A0B\u3067\u3054\u90FD\u5408\u306E\u826F\u3044\u304A\u6642\u9593\u3092\u304A\u9078\u3073\u304F\u3060\u3055\u3044\u3002\n\n\u24603/29(\u571F) 10:00\u301C\n\u24613/29(\u571F) 13:00\u301C\n\u24623/30(\u65E5) 10:00\u301C\n\n\u756A\u53F7\u3067\u304A\u8FD4\u4E8B\u3044\u305F\u3060\u3051\u307E\u3059\u3068\u5E78\u3044\u3067\u3059\u3002" },
  tpl_pet: { title: "\u30DA\u30C3\u30C8\u78BA\u8A8D", text: "\u30DA\u30C3\u30C8\u98FC\u80B2\u306E\u76F8\u8AC7\u53EF\u5426\u306B\u3064\u3044\u3066\u306F\u7269\u4EF6\u3084\u98FC\u80B2\u5185\u5BB9\u306B\u3088\u3063\u3066\u90FD\u5EA6\u78BA\u8A8D\u3068\u306A\u308A\u307E\u3059\u306E\u3067\u3001\n\u4EE5\u4E0B\u3054\u6559\u793A\u3044\u305F\u3060\u304F\u3053\u3068\u53EF\u80FD\u3067\u3057\u3087\u3046\u304B?\n\n\u30FB\u98FC\u80B2\u3055\u308C\u3066\u3044\u308B\u30DA\u30C3\u30C8\u306E\u7A2E\u5225:\n\u30FB\u98FC\u80B2\u3055\u308C\u3066\u3044\u308B\u30DA\u30C3\u30C8\u306E\u982D\u6570:\n\u30FB\u304A\u5F15\u8D8A\u3057\u6642\u671F:" },
  tpl_cost: { title: "\u521D\u671F\u8CBB\u7528\u56DE\u7B54", text: "\u521D\u671F\u8CBB\u7528\u306B\u3064\u304D\u307E\u3057\u3066\u3001\u6982\u7B97\u3092\u3054\u6848\u5185\u3044\u305F\u3057\u307E\u3059\u3002\n\n\u3010\u6982\u7B97\u521D\u671F\u8CBB\u7528\u3011\n\u30FB\u6577\u91D1: {deposit}\n\u30FB\u793C\u91D1: {keyMoney}\n\u30FB\u4EF2\u4ECB\u624B\u6570\u6599: {brokerageFee}\n\u30FB\u4FDD\u8A3C\u6599: {guaranteeFee}\n\u30FB\u706B\u707D\u4FDD\u967A: {insuranceFee}\n\u30FB\u9375\u4EA4\u63DB\u8CBB: {lockChangeFee}\n\u30FB\u524D\u5BB6\u8CC3: {advanceRent}\n\n\u203B\u4E0A\u8A18\u306F\u6982\u7B97\u3068\u306A\u308A\u307E\u3059\u3002\u6B63\u78BA\u306A\u91D1\u984D\u306F\u304A\u7533\u8FBC\u307F\u6642\u306B\u78BA\u5B9A\u3044\u305F\u3057\u307E\u3059\u3002" },
};

// ── Node definitions with positions ──
const NODE_W = 200;
const NODE_H = 56;
const BRANCH_W = 150;
const BRANCH_H = 72;

const initNodes: NodeData[] = [
  // Phase 1
  { id: "p1_inquiry", type: "trigger", label: "\u30DD\u30FC\u30BF\u30EB\u53CD\u97FF\u53D7\u4FE1", desc: "SUUMO / APAMAN / HOME'S", x: 400, y: 40, color: "#0891b2", phase: "1", icon: "\u{1F4E9}" },
  // Phase 2
  { id: "p2_vacancy", type: "agent", label: "\u7A7A\u5BA4\u72B6\u6CC1\u5224\u5B9A", desc: "8\u30D1\u30BF\u30FC\u30F3\u5206\u985E", x: 400, y: 140, color: "#a855f7", phase: "2", icon: "\u{1F50D}" },
  { id: "p2_1stmail", type: "action", label: "1st\u30E1\u30FC\u30EB\u9001\u4FE1", desc: "\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u5C55\u958B + AI\u88DC\u5B8C", x: 400, y: 240, color: "#a855f7", phase: "2", tplKey: "tpl_1st", icon: "\u{1F4E7}" },
  // Phase 3 - ABC classify
  { id: "p3_classify", type: "agent", label: "ABC\u5C64\u5206\u985E", desc: "\u8FD4\u4FE1\u5185\u5BB9\u3092AI\u5224\u5B9A", x: 400, y: 350, color: "#d4a017", phase: "3", icon: "\u{1F3F7}\uFE0F" },
  // Branches
  { id: "p3_a", type: "branch", label: "A\u5C64", desc: "\u30A2\u30DD\u65B9\u5411", x: 160, y: 460, color: "#22c55e", phase: "3A", icon: "\u2705" },
  { id: "p3_b", type: "branch", label: "B\u5C64", desc: "\u30BD\u30E0\u30EA\u30A8\u7406\u8AD6", x: 400, y: 460, color: "#eab308", phase: "3B", icon: "\u{1F914}" },
  { id: "p3_c", type: "branch", label: "C\u5C64", desc: "\u8FFD\u5BA25\u56DE", x: 640, y: 460, color: "#ef4444", phase: "3C", icon: "\u{1F4E4}" },
  // A-layer detail
  { id: "a_tentative", type: "agent", label: "\u3010\u672A\u78BA\u5B9A\u3011\u30D1\u30BF\u30FC\u30F3\u9078\u629E", desc: "a/b/c/d 4\u30D1\u30BF\u30FC\u30F3", x: 160, y: 570, color: "#22c55e", phase: "3A" },
  { id: "a_tent_a", type: "action", label: "a. \u5165\u5C45\u4E2D", desc: "\u5916\u89B3\u30FB\u5171\u7528\u90E8\u6848\u5185", x: 40, y: 680, color: "#34d399", tplKey: "tpl_tent_a" },
  { id: "a_tent_b", type: "action", label: "b. \u52DF\u96C6\u7D42\u4E86", desc: "\u4ED6\u7269\u4EF6\u7D39\u4ECB", x: 200, y: 680, color: "#34d399", tplKey: "tpl_tent_b" },
  { id: "a_tent_c", type: "action", label: "c. \u52DF\u96C6\u4E2D", desc: "\u5E97\u982D\u2192\u4E00\u6C17\u306B\u56DE\u308B", x: 40, y: 770, color: "#34d399", tplKey: "tpl_tent_c" },
  { id: "a_tent_d", type: "action", label: "d. \u5EFA\u7BC9\u4E2D", desc: "\u73FE\u72B6\u6848\u5185+\u4ED6\u7269\u4EF6", x: 200, y: 770, color: "#34d399", tplKey: "tpl_tent_d" },
  { id: "a_confirm", type: "action", label: "\u30A2\u30DD\u78BA\u5B9A", desc: "\u78BA\u5B9A\u30E1\u30FC\u30EB + \u901A\u77E5", x: 160, y: 870, color: "#14b8a6", tplKey: "tpl_confirm", icon: "\u2705" },
  // B-layer detail
  { id: "b_time", type: "action", label: "\u5F15\u8D8A\u3057\u6642\u671F\u78BA\u8A8D", desc: "\u30BD\u30E0\u30EA\u30A8\u8D77\u70B9", x: 400, y: 570, color: "#eab308", tplKey: "tpl_b_time", icon: "\u{1F5D3}" },
  { id: "b_push", type: "action", label: "\u6765\u5E97\u3059\u3079\u304D\u3068\u8A00\u3044\u5207\u308B", desc: "2\u30F6\u6708\u4EE5\u5185\u306A\u3089", x: 400, y: 680, color: "#eab308", tplKey: "tpl_b_push" },
  // C-layer detail
  { id: "c_fu1", type: "action", label: "\u2460 \u5F53\u65E5", desc: "\u7A7A\u5BA4\u30EA\u30DE\u30A4\u30F3\u30C9", x: 640, y: 570, color: "#ef4444", tplKey: "tpl_fu1" },
  { id: "c_fu2", type: "action", label: "\u2461 \u7FCC\u65E5", desc: "\u6761\u4EF6\u30D2\u30A2\u30EA\u30F3\u30B0", x: 640, y: 650, color: "#ef4444", tplKey: "tpl_fu2" },
  { id: "c_fu3", type: "action", label: "\u2462 2\u65E5\u5F8C", desc: "\u7DCA\u6025\u6027\u6F14\u51FA", x: 640, y: 730, color: "#ef4444", tplKey: "tpl_fu3" },
  { id: "c_fu4", type: "action", label: "\u2463 5\u65E5\u5F8C", desc: "\u5225\u89D2\u5EA6\u30A2\u30D7\u30ED\u30FC\u30C1", x: 640, y: 810, color: "#ef4444", tplKey: "tpl_fu4" },
  { id: "c_fu5", type: "action", label: "\u2464 10\u65E5\u5F8C", desc: "\u6700\u7D42\u30D5\u30A9\u30ED\u30FC", x: 640, y: 890, color: "#ef4444", tplKey: "tpl_fu5" },
  { id: "c_end", type: "end", label: "\u8FFD\u5BA2\u7D42\u4E86", desc: "\u30ED\u30F3\u30B0\u30D5\u30A9\u30ED\u30FC or \u7D42\u4E86", x: 640, y: 970, color: "#888" },
  // Phase 4/5
  { id: "p4_schedule", type: "agent", label: "\u65E5\u7A0B\u8ABF\u6574", desc: "\u30AB\u30EC\u30F3\u30C0\u30FC\u7A7A\u304D\u67A0\u53D6\u5F97", x: 160, y: 970, color: "#0891b2", tplKey: "tpl_slot", icon: "\u{1F4C5}" },
  { id: "p5_notify", type: "end", label: "\u62C5\u5F53\u8005\u306B\u901A\u77E5", desc: "\u5F15\u304D\u7D99\u304E\u5B8C\u4E86", x: 160, y: 1070, color: "#14b8a6", icon: "\u{1F514}" },
];

const initEdges: Edge[] = [
  { from: "p1_inquiry", to: "p2_vacancy" },
  { from: "p2_vacancy", to: "p2_1stmail", color: "#a855f7" },
  { from: "p2_1stmail", to: "p3_classify" },
  { from: "p3_classify", to: "p3_a", label: "\u30A2\u30DD\u610F\u6B32", color: "#22c55e" },
  { from: "p3_classify", to: "p3_b", label: "\u691C\u8A0E\u4E2D", color: "#eab308" },
  { from: "p3_classify", to: "p3_c", label: "\u7121\u53CD\u5FDC", color: "#ef4444" },
  { from: "p3_a", to: "a_tentative", color: "#22c55e" },
  { from: "a_tentative", to: "a_tent_a", color: "#34d399" },
  { from: "a_tentative", to: "a_tent_b", color: "#34d399" },
  { from: "a_tentative", to: "a_tent_c", color: "#34d399" },
  { from: "a_tentative", to: "a_tent_d", color: "#34d399" },
  { from: "a_tent_a", to: "a_confirm", color: "#14b8a6" },
  { from: "a_tent_b", to: "a_confirm", color: "#14b8a6" },
  { from: "a_tent_c", to: "a_confirm", color: "#14b8a6" },
  { from: "a_tent_d", to: "a_confirm", color: "#14b8a6" },
  { from: "a_confirm", to: "p4_schedule", color: "#0891b2" },
  { from: "p4_schedule", to: "p5_notify", color: "#14b8a6" },
  { from: "p3_b", to: "b_time", color: "#eab308" },
  { from: "b_time", to: "b_push", color: "#eab308" },
  { from: "p3_c", to: "c_fu1", color: "#ef4444" },
  { from: "c_fu1", to: "c_fu2", color: "#ef4444" },
  { from: "c_fu2", to: "c_fu3", color: "#ef4444" },
  { from: "c_fu3", to: "c_fu4", color: "#ef4444" },
  { from: "c_fu4", to: "c_fu5", color: "#ef4444" },
  { from: "c_fu5", to: "c_end", color: "#ef4444" },
];

// ── Edge path calculation ──
function getEdgePath(from: NodeData, to: NodeData, nodes: NodeData[]): string {
  const fw = from.type === "branch" ? BRANCH_W : NODE_W;
  const th = to.type === "branch" ? BRANCH_H : NODE_H;
  const fx = from.x + fw / 2;
  const fy = from.y + (from.type === "branch" ? BRANCH_H : NODE_H);
  const tx = to.x + (to.type === "branch" ? BRANCH_W : NODE_W) / 2;
  const ty = to.y;
  if (Math.abs(fx - tx) < 5) {
    return `M${fx},${fy} L${tx},${ty}`;
  }
  const midY = fy + (ty - fy) * 0.5;
  return `M${fx},${fy} C${fx},${midY} ${tx},${midY} ${tx},${ty}`;
}

// ── Canvas Component ──
function SynapseCanvas({ nodes, edges, selected, onSelect, onDrag }: {
  nodes: NodeData[]; edges: Edge[]; selected: string | null;
  onSelect: (id: string | null) => void;
  onDrag: (id: string, x: number, y: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const nodeMap = useMemo(() => {
    const m: Record<string, NodeData> = {};
    nodes.forEach(n => m[n.id] = n);
    return m;
  }, [nodes]);

  const maxY = useMemo(() => Math.max(...nodes.map(n => n.y + (n.type === "branch" ? BRANCH_H : NODE_H))) + 60, [nodes]);
  const maxX = useMemo(() => Math.max(...nodes.map(n => n.x + (n.type === "branch" ? BRANCH_W : NODE_W))) + 60, [nodes]);

  const handleMouseDown = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    const node = nodeMap[id];
    if (!node) return;
    dragRef.current = { id, offsetX: svgP.x - node.x, offsetY: svgP.y - node.y };
    onSelect(id);
  }, [nodeMap, onSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    onDrag(dragRef.current.id, svgP.x - dragRef.current.offsetX, svgP.y - dragRef.current.offsetY);
  }, [onDrag]);

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  return (
    <svg
      ref={svgRef}
      width="100%"
      viewBox={`0 0 ${maxX} ${maxY}`}
      style={{ cursor: dragRef.current ? "grabbing" : "default", minHeight: 600 }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={() => onSelect(null)}
    >
      <defs>
        <marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </marker>
        <filter id="glow"><feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#d4a017" floodOpacity="0.25" /></filter>
        <filter id="sel"><feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#0891b2" floodOpacity="0.4" /></filter>
      </defs>

      {/* Edges */}
      {edges.map((edge, i) => {
        const from = nodeMap[edge.from];
        const to = nodeMap[edge.to];
        if (!from || !to) return null;
        const d = getEdgePath(from, to, nodes);
        return (
          <g key={i}>
            <path d={d} fill="none" stroke={edge.color || "#ccc"} strokeWidth="1.5" markerEnd="url(#ah)" opacity={0.6} />
            {edge.label && (() => {
              const fw = from.type === "branch" ? BRANCH_W : NODE_W;
              const fx = from.x + fw / 2;
              const fy = from.y + (from.type === "branch" ? BRANCH_H : NODE_H);
              const tx = to.x + (to.type === "branch" ? BRANCH_W : NODE_W) / 2;
              const ty = to.y;
              const mx = (fx + tx) / 2;
              const my = (fy + ty) / 2;
              return (
                <text x={mx} y={my - 6} textAnchor="middle" fontSize="10" fontWeight="600" fill={edge.color || "#888"} fontFamily="'Rajdhani', sans-serif">{edge.label}</text>
              );
            })()}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map(node => {
        const w = node.type === "branch" ? BRANCH_W : NODE_W;
        const h = node.type === "branch" ? BRANCH_H : NODE_H;
        const isSel = selected === node.id;
        const hasTpl = !!node.tplKey;

        return (
          <g
            key={node.id}
            style={{ cursor: "grab" }}
            onMouseDown={e => handleMouseDown(e, node.id)}
            onClick={e => { e.stopPropagation(); onSelect(node.id); }}
          >
            {/* Shadow */}
            <rect x={node.x + 2} y={node.y + 2} width={w} height={h} rx={node.type === "branch" ? 12 : 8} fill="rgba(0,0,0,0.06)" />
            {/* Main rect */}
            <rect
              x={node.x} y={node.y} width={w} height={h}
              rx={node.type === "branch" ? 12 : 8}
              fill="#fff"
              stroke={isSel ? "#0891b2" : node.color}
              strokeWidth={isSel ? 2 : 1}
              filter={isSel ? "url(#sel)" : undefined}
            />
            {/* Color accent bar */}
            <rect x={node.x} y={node.y} width={4} height={h} rx={2} fill={node.color} />
            {/* Phase badge */}
            {node.phase && (
              <>
                <rect x={node.x + w - 28} y={node.y + 4} width={24} height={14} rx={7} fill={node.color} opacity={0.15} />
                <text x={node.x + w - 16} y={node.y + 14} textAnchor="middle" fontSize="8" fontWeight="700" fill={node.color} fontFamily="'JetBrains Mono', monospace">{node.phase}</text>
              </>
            )}
            {/* Icon + Label */}
            <text x={node.x + 14} y={node.y + (node.type === "branch" ? 26 : 22)} fontSize="12" fontWeight="700" fill="#1a1a1a" fontFamily="'Rajdhani', 'Noto Sans JP', sans-serif">
              {node.icon ? `${node.icon} ` : ""}{node.label}
            </text>
            {/* Description */}
            <text x={node.x + 14} y={node.y + (node.type === "branch" ? 44 : 40)} fontSize="10" fill="#888" fontFamily="'Noto Sans JP', sans-serif">
              {node.desc.length > 22 ? node.desc.slice(0, 22) + "\u2026" : node.desc}
            </text>
            {/* Template indicator */}
            {hasTpl && (
              <>
                <rect x={node.x + w - 22} y={node.y + h - 18} width={18} height={14} rx={3} fill={isSel ? "#0891b2" : "#f3f4f6"} />
                <text x={node.x + w - 13} y={node.y + h - 8} textAnchor="middle" fontSize="8" fill={isSel ? "#fff" : "#999"}>T</text>
              </>
            )}
            {/* Branch type indicator (diamond) */}
            {node.type === "branch" && (
              <polygon
                points={`${node.x + w / 2},${node.y + h - 10} ${node.x + w / 2 - 5},${node.y + h - 5} ${node.x + w / 2},${node.y + h} ${node.x + w / 2 + 5},${node.y + h - 5}`}
                fill={node.color} opacity={0.4}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Snippet type from CRM DB ──
type Snippet = { id: string; name: string; body: string; category: string; channel: string };

// ── Right Panel: Template Editor ──
function TemplatePanel({ nodeId, nodes, tpls, onChange, onSave, saving, saveMsg }: {
  nodeId: string | null; nodes: NodeData[];
  tpls: Record<string, { title: string; text: string }>;
  onChange: (key: string, text: string) => void;
  onSave: (key: string) => void; saving: boolean; saveMsg: string;
}) {
  const node = nodeId ? nodes.find(n => n.id === nodeId) : null;
  const tplKey = node?.tplKey;
  const tpl = tplKey ? tpls[tplKey] : null;

  // Snippet DB state
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [snippetSearch, setSnippetSearch] = useState("");
  const [snippetLoading, setSnippetLoading] = useState(false);
  const [snippetLoaded, setSnippetLoaded] = useState(false);
  const [expandedSnippet, setExpandedSnippet] = useState<string | null>(null);

  // Load snippets from CRM on first expand
  const loadSnippets = useCallback(async () => {
    if (snippetLoaded) return;
    setSnippetLoading(true);
    try {
      const r = await fetch("/api/templates");
      const data = await r.json();
      const arr = Array.isArray(data) ? data : data.templates || [];
      setSnippets(arr);
      setSnippetLoaded(true);
    } catch { setSnippets([]); }
    setSnippetLoading(false);
  }, [snippetLoaded]);

  // Filter snippets by search
  const filtered = useMemo(() => {
    if (!snippetSearch.trim()) return snippets;
    const q = snippetSearch.toLowerCase();
    return snippets.filter(s =>
      s.name.toLowerCase().includes(q) || s.body.toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q)
    );
  }, [snippets, snippetSearch]);

  // Insert snippet text into current template
  const insertSnippet = useCallback((snippetBody: string) => {
    if (!tplKey || !tpl) return;
    const newText = tpl.text + "\n\n" + snippetBody;
    onChange(tplKey, newText);
  }, [tplKey, tpl, onChange]);

  if (!node) {
    return (
      <div style={{ padding: 24, color: "#aaa", textAlign: "center", marginTop: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>{"\u{1F4DD}"}</div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{"\u30CE\u30FC\u30C9\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044"}</div>
        <div style={{ fontSize: 11, marginTop: 4, color: "#ccc" }}>{"\u30AF\u30EA\u30C3\u30AF\u3067\u8A73\u7D30\u3092\u8868\u793A\u30FB\u7DE8\u96C6"}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, overflowY: "auto", height: "100%" }}>
      {/* Node info header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <div style={{ width: 4, height: 32, borderRadius: 2, background: node.color }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", fontFamily: "'Rajdhani', sans-serif" }}>
            {node.icon} {node.label}
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>{node.desc}</div>
        </div>
        {node.phase && (
          <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: node.color, background: `${node.color}15`, padding: "2px 8px", borderRadius: 10, fontFamily: "'JetBrains Mono', monospace" }}>
            Phase {node.phase}
          </span>
        )}
      </div>

      {/* Node properties */}
      <div style={{ background: "#f9fafb", borderRadius: 8, padding: 12, marginBottom: 16, border: "1px solid #f0f0f0" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{"\u30CE\u30FC\u30C9\u60C5\u5831"}</div>
        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "4px 8px", fontSize: 11 }}>
          <span style={{ color: "#aaa" }}>ID</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#555", fontSize: 10 }}>{node.id}</span>
          <span style={{ color: "#aaa" }}>{"\u30BF\u30A4\u30D7"}</span>
          <span style={{ color: "#555" }}>{node.type}</span>
          <span style={{ color: "#aaa" }}>{"\u4F4D\u7F6E"}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#555", fontSize: 10 }}>x:{Math.round(node.x)} y:{Math.round(node.y)}</span>
        </div>
      </div>

      {/* Template editor */}
      {tpl ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>{"\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8"}</div>
            <button
              onClick={() => tplKey && onSave(tplKey)}
              disabled={saving}
              style={{
                background: saving ? "#e5e7eb" : "#d4a017", border: "none", color: "#fff",
                borderRadius: 6, padding: "4px 12px", fontSize: 10, fontWeight: 700,
                cursor: saving ? "default" : "pointer", transition: "all 0.15s"
              }}
            >
              {saving ? "\u4FDD\u5B58\u4E2D..." : "\u{1F4BE} \u4FDD\u5B58"}
            </button>
          </div>
          {saveMsg && <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: saveMsg.startsWith("\u2705") ? "#22c55e" : "#ef4444" }}>{saveMsg}</div>}
          <div style={{ fontSize: 12, fontWeight: 600, color: "#333", marginBottom: 6 }}>{tpl.title}</div>
          <textarea
            value={tpl.text}
            onChange={e => tplKey && onChange(tplKey, e.target.value)}
            style={{
              width: "100%", minHeight: 240, background: "#fafafa", color: "#333",
              border: "1px solid #e5e7eb", borderRadius: 8, padding: 10,
              fontSize: 11, fontFamily: "'JetBrains Mono', 'Noto Sans JP', monospace",
              lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box",
              transition: "border-color 0.15s"
            }}
            onFocus={e => (e.target.style.borderColor = "#0891b2")}
            onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
          />
          <div style={{ fontSize: 9, color: "#bbb", marginTop: 6 }}>
            {"\u5909\u6570: {{customer_name}} {{store_name}} {{staff_name}} {{visit_url}} {{line_url}} {visit_proposal} {store_access}"}
          </div>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: "center", color: "#ccc", fontSize: 11 }}>
          {"\u3053\u306E\u30CE\u30FC\u30C9\u306B\u306F\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u304C\u3042\u308A\u307E\u305B\u3093"}
        </div>
      )}

      {/* Snippet DB with search */}
      <div style={{ marginTop: 20, borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>{"\u5B9A\u578B\u6587DB"}</div>
          {!snippetLoaded && (
            <button onClick={loadSnippets} disabled={snippetLoading} style={{
              fontSize: 9, padding: "2px 8px", borderRadius: 4, border: "1px solid #e5e7eb",
              background: snippetLoading ? "#f3f4f6" : "#fff", color: "#888", cursor: snippetLoading ? "default" : "pointer",
            }}>
              {snippetLoading ? "\u8AAD\u8FBC\u4E2D..." : "\u{1F504} CRM\u304B\u3089\u53D6\u5F97"}
            </button>
          )}
          {snippetLoaded && <span style={{ fontSize: 9, color: "#22c55e" }}>{snippets.length}\u4EF6</span>}
        </div>

        {/* Search input */}
        <div style={{ position: "relative", marginBottom: 8 }}>
          <input
            type="text"
            value={snippetSearch}
            onChange={e => { setSnippetSearch(e.target.value); if (!snippetLoaded) loadSnippets(); }}
            onFocus={() => { if (!snippetLoaded) loadSnippets(); }}
            placeholder={"\u{1F50D} \u5B9A\u578B\u6587\u3092\u691C\u7D22..."}
            style={{
              width: "100%", padding: "6px 10px 6px 10px", fontSize: 11,
              border: "1px solid #e5e7eb", borderRadius: 6, outline: "none",
              background: "#fafafa", color: "#333", boxSizing: "border-box",
              transition: "border-color 0.15s", fontFamily: "'Noto Sans JP', sans-serif",
            }}
            onFocusCapture={e => (e.target.style.borderColor = "#0891b2")}
            onBlurCapture={e => (e.target.style.borderColor = "#e5e7eb")}
          />
        </div>

        {/* Snippet list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3, maxHeight: 400, overflowY: "auto" }}>
          {snippetLoading && <div style={{ fontSize: 10, color: "#aaa", textAlign: "center", padding: 12 }}>{"\u8AAD\u307F\u8FBC\u307F\u4E2D..."}</div>}

          {snippetLoaded && filtered.length === 0 && (
            <div style={{ fontSize: 10, color: "#ccc", textAlign: "center", padding: 12 }}>
              {snippetSearch ? "\u691C\u7D22\u7D50\u679C\u306A\u3057" : "\u5B9A\u578B\u6587\u304C\u3042\u308A\u307E\u305B\u3093"}
            </div>
          )}

          {/* Agent templates (hardcoded) */}
          {!snippetLoaded && !snippetLoading && Object.entries(tpls).map(([key, t]) => (
            <div
              key={key}
              style={{
                fontSize: 10, padding: "6px 8px", borderRadius: 6, cursor: "pointer",
                background: tplKey === key ? `${node.color}10` : "transparent",
                border: tplKey === key ? `1px solid ${node.color}30` : "1px solid transparent",
                color: tplKey === key ? node.color : "#888",
                fontWeight: tplKey === key ? 700 : 400, transition: "all 0.15s",
              }}
              onClick={() => onChange(key, t.text)}
            >
              {t.title}
            </div>
          ))}

          {/* CRM snippets with expand/insert */}
          {snippetLoaded && filtered.map(s => (
            <div key={s.id} style={{
              border: "1px solid #f0f0f0", borderRadius: 6, overflow: "hidden",
              transition: "all 0.15s", background: expandedSnippet === s.id ? "#f8fafc" : "#fff",
            }}>
              <div
                style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 8px",
                  cursor: "pointer", fontSize: 10,
                }}
                onClick={() => setExpandedSnippet(prev => prev === s.id ? null : s.id)}
              >
                <span style={{ flex: 1, fontWeight: 600, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                {s.category && <span style={{ fontSize: 8, padding: "1px 4px", borderRadius: 3, background: "#f0f0f0", color: "#999" }}>{s.category}</span>}
                <span style={{ fontSize: 8, color: "#ccc" }}>{expandedSnippet === s.id ? "\u25B2" : "\u25BC"}</span>
              </div>
              {expandedSnippet === s.id && (
                <div style={{ padding: "0 8px 8px", borderTop: "1px solid #f0f0f0" }}>
                  <pre style={{
                    fontSize: 9, color: "#666", lineHeight: 1.5, margin: "6px 0",
                    fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap",
                    maxHeight: 120, overflowY: "auto", background: "#fafafa",
                    padding: 6, borderRadius: 4,
                  }}>
                    {s.body.length > 300 ? s.body.slice(0, 300) + "\u2026" : s.body}
                  </pre>
                  <button
                    onClick={() => insertSnippet(s.body)}
                    disabled={!tplKey}
                    style={{
                      width: "100%", padding: "4px 0", fontSize: 9, fontWeight: 700,
                      border: "none", borderRadius: 4, cursor: tplKey ? "pointer" : "not-allowed",
                      background: tplKey ? "#0891b2" : "#e5e7eb", color: tplKey ? "#fff" : "#aaa",
                      transition: "all 0.15s",
                    }}
                  >
                    {tplKey ? "\u2B07 \u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u306B\u633F\u5165" : "\u30CE\u30FC\u30C9\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──
export default function AgentFlowPage() {
  const [nodes, setNodes] = useState<NodeData[]>(initNodes);
  const [edges] = useState<Edge[]>(initEdges);
  const [selected, setSelected] = useState<string | null>(null);
  const [tpls, setTpls] = useState(TEMPLATES);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Load templates from DB on mount
  useEffect(() => {
    fetch("/api/agent/templates").then(r => r.json()).then(data => {
      if (data.templates?.length) {
        const merged = { ...TEMPLATES };
        for (const t of data.templates) {
          if (merged[t.key]) merged[t.key] = { title: t.title, text: t.body };
        }
        setTpls(merged);
      }
    }).catch(() => {});
  }, []);

  const changeTpl = useCallback((k: string, text: string) => {
    setTpls(prev => ({ ...prev, [k]: { ...prev[k], text } }));
  }, []);

  const saveTpl = useCallback(async (key: string) => {
    setSaving(true); setSaveMsg("");
    try {
      const t = tpls[key];
      const r = await fetch("/api/agent/templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, title: t.title, body: t.text }),
      });
      if (r.ok) setSaveMsg("\u2705 \u4FDD\u5B58\u3057\u307E\u3057\u305F");
      else setSaveMsg("\u274C \u4FDD\u5B58\u30A8\u30E9\u30FC");
    } catch { setSaveMsg("\u274C \u4FDD\u5B58\u30A8\u30E9\u30FC"); }
    setSaving(false);
    setTimeout(() => setSaveMsg(""), 2000);
  }, [tpls]);

  const handleDrag = useCallback((id: string, x: number, y: number) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, x: Math.max(0, x), y: Math.max(0, y) } : n));
  }, []);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 56px)", fontFamily: "'Rajdhani', 'Noto Sans JP', sans-serif", overflow: "hidden" }}>
      {/* Left: Canvas */}
      <div style={{ flex: 1, overflow: "auto", background: "#fafafa", position: "relative" }}>
        {/* Header bar */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "rgba(250,250,250,0.92)", backdropFilter: "blur(8px)",
          borderBottom: "1px solid #e5e7eb", padding: "10px 20px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg, #d4a017, #0891b2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 14 }}>{"\u{1F9E0}"}</span>
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a1a" }}>Synapse Flow Editor</div>
            <div style={{ fontSize: 10, color: "#aaa" }}>{"\u30CE\u30FC\u30C9\u3092\u30C9\u30E9\u30C3\u30B0\u3067\u914D\u7F6E \u00B7 \u30AF\u30EA\u30C3\u30AF\u3067\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u7DE8\u96C6"}</div>
          </div>
          {/* Phase legend */}
          <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { c: "#0891b2", l: "P1" }, { c: "#a855f7", l: "P2" }, { c: "#d4a017", l: "P3" },
              { c: "#22c55e", l: "A" }, { c: "#eab308", l: "B" }, { c: "#ef4444", l: "C" },
              { c: "#14b8a6", l: "P5" },
            ].map(i => (
              <div key={i.l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: i.c }} />
                <span style={{ fontSize: 9, color: "#888", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{i.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas area */}
        <div style={{ padding: "16px 20px" }}>
          <SynapseCanvas
            nodes={nodes}
            edges={edges}
            selected={selected}
            onSelect={setSelected}
            onDrag={handleDrag}
          />
        </div>
      </div>

      {/* Right: Template Panel */}
      <div style={{
        width: 320, minWidth: 320, borderLeft: "1px solid #e5e7eb",
        background: "#fff", overflowY: "auto",
      }}>
        {/* Panel header */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #f0f0f0",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: selected ? "#22c55e" : "#ddd" }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#555" }}>{"\u30C6\u30F3\u30D7\u30EC\u30FC\u30C8\u30A8\u30C7\u30A3\u30BF"}</span>
        </div>
        <TemplatePanel
          nodeId={selected}
          nodes={nodes}
          tpls={tpls}
          onChange={changeTpl}
          onSave={saveTpl}
          saving={saving}
          saveMsg={saveMsg}
        />
      </div>
    </div>
  );
}
