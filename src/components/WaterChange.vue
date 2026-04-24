<script lang="ts" setup>
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import * as echarts from "echarts";
import { getWaters } from '@/api'
import type { Water } from '@/types'

let chart: echarts.ECharts;
const waterChange = ref()
const dataJson = ref<Water[]>()

const updateChart = () => {
  if (!chart) return
  chart.setOption({
    title: {
      text: '24小时水情变化',
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
      data: dataJson.value.map(i => i.time),
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
        name: '水位(米)',
        type: 'line',
        smooth: true,
        data: dataJson.value.map(i => i.waterLevel),
        areaStyle: {
          color: 'rgba(0, 136, 212, 0.2)'
        },
        lineStyle: {
          color: '#00eaff'
        }
      }
    ]
  })
};

const resizeChart = () => {
  chart?.resize();
};

watch(() => dataJson.value, updateChart, { deep: true })
const initData = () => {
  getWaters().then(res => {
    dataJson.value = res;
  })
}
initData()
onMounted(() => {
  if (waterChange.value) {
    chart = echarts.init(waterChange.value);
    
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
    <div ref="waterChange" class="month-data"></div>
  </template>
  <style scoped>
  .month-data {
    width: 100%;
    height: 100%;
  }
  </style>