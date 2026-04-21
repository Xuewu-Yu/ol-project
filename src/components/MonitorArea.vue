<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import * as echarts from "echarts";

let chart: echarts.ECharts;
const monitorCount = ref();

const { data } = defineProps<{
  data: Record<string, number>;
}>();

const xAxisData = computed(() => Object.keys(data))
const seriesData = computed(() => Object.values(data))
const updateChart = () => {
  if (!chart) return
  chart.setOption({
    title: {
      text: '检测分布点情况',
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
      data: xAxisData.value,
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
        name: '分布情况',
        type: 'bar',
        data: seriesData.value
      }
    ]
  })
};

const resizeChart = () => {
  chart?.resize();
};

watch(() => data, updateChart, { deep: true })

onMounted(() => {
  if (monitorCount.value) {
    chart = echarts.init(monitorCount.value);
    updateChart();
    window.addEventListener("resize", resizeChart);
  }
});
onUnmounted(() => {
  window.removeEventListener("resize", resizeChart);
  chart?.dispose();
});
</script>
<template>
  <div ref="monitorCount" class="monitor-count"></div>
</template>
<style scoped>
.monitor-count {
  width: 100%;
  height: 100%;
}
</style>