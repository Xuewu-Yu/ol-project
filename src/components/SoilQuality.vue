<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref, watch } from "vue";
import * as echarts from "echarts";

let chart: echarts.ECharts;
const soilQuality = ref();

const { data } = defineProps<{
  data: Record<string, number>;
}>();

const pieData = computed(() => {
  return Object.entries(data).map(item => ({
    name: item[0],
    value: item[1]
  }))
})
const updateChart = () => {
  if (!chart) return
  chart.setOption({
    title: {
      text: '监测面积覆盖率',
      textStyle: {
        color: '#ededed'
      },
      top: 20,
      left: 20,
    },
    tooltip: {},
    series: [
      {
        name: '等级情况',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['50%', '75%'],
        startAngle: 180,
        endAngle: 360,
        label: {
          fontSize: 14,
          color: '#ededed',
        },
        data: pieData.value
      }
    ]
  })
};

const resizeChart = () => {
  chart?.resize();
};

watch(() => data, updateChart, { deep: true })

onMounted(() => {
  if (soilQuality.value) {
    chart = echarts.init(soilQuality.value);
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
  <div ref="soilQuality" class="soil-quality"></div>
</template>
<style scoped>
.soil-quality {
  width: 100%;
  height: 100%;
}
</style>