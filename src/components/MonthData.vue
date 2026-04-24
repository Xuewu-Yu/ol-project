<script lang="ts" setup>
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import * as echarts from "echarts";
import { getMonthData } from '@/api'
import type { Month } from '@/types'

let chart: echarts.ECharts;
const monthData = ref()
const dataJson = ref<Month[]>()

const updateChart = () => {
  if (!chart) return
  chart.setOption({
    title: {
      text: '每月监测统计',
      textStyle: {
        color: '#ededed'
      },
      top: 20,
      left: 20
    },
    tooltip: {},
    grid: {
      bottom: 40,
      top: 70,
    },
    xAxis: {
      data: dataJson.value.map(i => i.name),
      axisLabel: {
        color: '#ededed'
      }
    },
    yAxis: {
      axisLabel: {
        color: '#ededed'
      }
    },
    series: [
      {
        name: '监测统计',
        type: 'line',
        data: dataJson.value.map(i => i.count)
      }
    ]
  })
};

const resizeChart = () => {
  chart?.resize();
};

watch(() => dataJson.value, updateChart, { deep: true })
const initData = () => {
    getMonthData().then(res => {
        dataJson.value = res;
    })
}
initData()
onMounted(() => {
  if (monthData.value) {
    chart = echarts.init(monthData.value);
    
    dataJson.value && updateChart();
    
    window.addEventListener("resize", resizeChart);
  }
});
onUnmounted(() => {
  window.removeEventListener("resize", resizeChart);
  chart?.dispose();
});
</script>
<template>
    <div ref="monthData" class="month-data"></div>
  </template>
  <style scoped>
  .month-data {
    width: 100%;
    height: 100%;
  }
  </style>