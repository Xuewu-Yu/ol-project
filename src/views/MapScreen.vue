<script setup lang="ts">
import { onMounted, ref, onUnmounted, reactive } from "vue";
import { Map, MapBrowserEvent, View, Feature, Overlay } from "ol";
import { Vector as VectorLayer, Heatmap as HeatmapLayer } from "ol/layer";
import { Vector } from "ol/source";
import { GeoJSON } from "ol/format";
import { Style, Fill, Stroke, Text, Circle } from "ol/style";
import { Geometry } from 'ol/geom'

import dayjs from "dayjs";
import colormap from 'colormap'

import { ZJS_GeoJSON_URL, ZJS_CITYS, GeoJSON_URL, QUALITY_LEVELS } from "@/config";
import { getMonitors } from '@/api'
import { monitorGeoJSON } from '@/utils'

import { Monitor } from "@/types";
import type { FeatureLike } from "ol/Feature";

import MonitorCount from '@/components/MonitorCount.vue'
import MonitorArea from '@/components/MonitorArea.vue'
import SoilQuality from '@/components/SoilQuality.vue'
import MonthData from '@/components/MonthData.vue'
import MonitorOpen from '@/components/MonitorOpen.vue'
import WaterChange from '@/components/WaterChange.vue'


let timer: ReturnType<typeof setInterval> | null = null;
let rippleTimer: number
let map: Map;
let overlay: Overlay
const FORMAT_TIME = "YYYY-MM-DD HH:mm:ss";
const nowTime = ref(dayjs().format(FORMAT_TIME));
const isFull = ref(false);
const nowCity = ref('')
const isLoading = ref(true)
const rippleProgress = ref(0)
const monitorOverlay = ref(null)
const cityCount = reactive<Record<string, number>>({})
const cityArea = reactive<Record<string, number>>({})
const soilQuality = reactive<Record<string, number>>({})
const monitorOpen = reactive<Record<string, number>>({})

const steps = 10
const ramp = colormap({
  colormap: 'earth',
  nshades: steps
})

const cityVectorSource = new Vector({
  url: ZJS_GeoJSON_URL,
  format: new GeoJSON({
    dataProjection: "EPSG:4326",
    featureProjection: "EPSG:3857",
  }),
});
const cityVectorStyle = (feature: FeatureLike) => {
  const city = feature.get("name");
  const text = cityCount[city] ? `${city} (${cityCount[city]})` : city
  return new Style({
    fill: new Fill({
      color: getColor(feature) + "CC",
    }),
    stroke: new Stroke({
      color: "#0000FF",
      width: 0.5,
    }),
    text: new Text({
      text,
      fill: new Fill({
        color: "#000000CC",
      }),
      font: "14px sans-serif",
    }),
  });
};

const cityLayer = new VectorLayer({
  source: cityVectorSource,
  style: cityVectorStyle,
});

const qualityLayer =  new HeatmapLayer({
  source: new Vector<Feature<Geometry>>({
    features: []
  }),
  blur: 15,
  radius: 20,
  weight: (feature: FeatureLike) => {
    const quality = feature.get('quality')
    return 1 - quality / 10
  }
})
const areaLayer = new VectorLayer({
  source: new Vector<Feature<Geometry>>({
    features: []
  }),
  style: (f:FeatureLike) => {
    const monitorArea = f.get('monitorArea')
    const rippleRadius = (monitorArea + 30) * rippleProgress.value
    const opaccity = 1 - rippleProgress.value
    return new Style({
      image: new Circle({
        radius: rippleRadius,
        stroke: new Stroke({
          color: `rgba(255,0,0, ${opaccity})`,
          width: 2
        })
      })
    })
  }
})

const clamp = (value: number, low: number, high: number) => {
  return Math.max(low, Math.min(value, high))
}
const getColor = (feature: FeatureLike) => {
  const city = feature.get('name')
  const cityCountValue = cityCount[city] || 0 + 3
  const min = 0
  const max = 10 
  const t = (cityCountValue - min) / (max - min)
  const index = Math.round(clamp(t, 0, 1) * (steps - 1))
  return ramp[index]
}

const handleScreenFull = () => {
  if (isFull.value) {
    document.exitFullscreen();
  } else {
    document.documentElement.requestFullscreen();
  }
  isFull.value = !isFull.value;
};
const handleClickFeature = (e: MapBrowserEvent) => {
  // console.log(e)
  const cityFeature = map.forEachFeatureAtPixel(
    e.pixel,
    (feat) => {
      return feat instanceof Feature ? feat : null;
    },
    {
      layerFilter: (layer) => layer === cityLayer,
    }
  );
  if (cityFeature) {
    const geometry = cityFeature.getGeometry()
    const adcode = cityFeature.get('adcode')
    const name = cityFeature.get('name')
    const hasCity = ZJS_CITYS.some(item => item.value === adcode)
    if (geometry && hasCity) {
      qualityLayer.getSource()?.clear()
      areaLayer.getSource()?.clear()
      map.getView().fit(geometry.getExtent(), {
        duration: 500,
        callback() {
          isLoading.value = true
          nowCity.value = name;
          cityVectorSource.clear()
          cityVectorSource.setUrl(`${GeoJSON_URL}?code=${adcode}_full`)
          cityVectorSource.refresh()
        }
      })
    }
  }
}

const handleMapBack = () => {
  initMonitors()
  isLoading.value = true
  nowCity.value = '';
  cityVectorSource.clear()
  cityVectorSource.setUrl(`${ZJS_GeoJSON_URL}`)
  cityVectorSource.refresh()
}

const initMonitors = () => {
  getMonitors().then(res => {
    res.forEach((item): Monitor => {
      const city = item.city
      cityCount[city] = (cityCount[city] || 0) + 1
      cityArea.monitorArea = (cityArea.monitorArea || 0) + item.monitorArea
      cityArea.allArea = (cityArea.allArea || 0) + item.allArea
      const qualityName = QUALITY_LEVELS.find(level => level.value === item.quality)?.name
      soilQuality[qualityName] = (soilQuality[qualityName] || 0) + 1
      monitorOpen[item.status] = (monitorOpen[item.status] || 0) + 1
    })
    const features = new GeoJSON().readFeatures(monitorGeoJSON(res), {
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    })
    qualityLayer.getSource()?.addFeatures(features)
    areaLayer.getSource()?.addFeatures(features)
  })
}

const handleMoveOverlay = (e: MapBrowserEvent) => {
  const monitorFeature = map.forEachFeatureAtPixel(e.pixel, (feat) => {
    return feat instanceof Feature ? feat : null
  }, {
    layerFilter: (layer) => layer === qualityLayer,
  })
  if (monitorFeature) {
    const properties = monitorFeature.getProperties()
    const qualityName = QUALITY_LEVELS.find(level => level.value === properties.quality)?.name || ''
    const content = `
      <div>
        ${properties.name}<br />
        城市：${properties.city}<br />
        设备状态：${properties.status === 'on' ? '启动' : '关闭'}<br />
        土壤质量：${qualityName}<br />
        覆盖面积：${properties.monitorArea} km²
      </div>
    `
    const pixel = map.getPixelFromCoordinate(e.coordinate)
    pixel[1] -= 10
    const offsetCoord = map.getCoordinateFromPixel(pixel)
    overlay.setPosition(offsetCoord)
    monitorOverlay.value.innerHTML = content
    monitorOverlay.value.style.display = 'block'
  } else {
    overlay.setPosition(undefined)
    monitorOverlay.value.style.display = 'none'
  }
}

onMounted(() => {
  timer = setInterval(() => {
    nowTime.value = dayjs().format(FORMAT_TIME);
  }, 1000);

  overlay = new Overlay({
    element: monitorOverlay.value,
    positioning: 'bottom-center'
  })

  map = new Map({
    target: "chart-map",
    layers: [cityLayer, qualityLayer, areaLayer],
    view: new View({
      center: [0, 0],
      zoom: 2,
    }),
    controls: [],
    overlays: [overlay]
  });
  cityVectorSource.on("change", () => {
    if (cityVectorSource.getState() === "ready") {
      const extent = cityVectorSource.getExtent();
      if (extent[0] != Infinity) {
        map.getView().fit(extent, { size: map.getSize(), duration: 1000 });
      }
    }
  });
  map.on('singleclick', handleClickFeature)
  map.on('pointermove', handleMoveOverlay)
  map.on('loadend', () => {
    isLoading.value = false
  })

  initMonitors()
  
  const animateRipple = () => {
    rippleProgress.value += 0.01
    if (rippleProgress.value > 1) rippleProgress.value = 0
    areaLayer.changed()
    rippleTimer = requestAnimationFrame(animateRipple)
  }
  animateRipple()
});
onUnmounted(() => {
  timer && clearInterval(timer);
  if (rippleTimer) cancelAnimationFrame(rippleTimer)
});
</script>
<template>
  <div id="map-screen">
    <div class="header-container">
      <div class="header-city">
        <i class="iconfont icon-chengshi"></i>
        <span class="map-back" @click="handleMapBack">浙江省</span>
        <span v-if="nowCity"> / {{ nowCity }}</span>
      </div>
      <div class="header-title">土壤质量检测驾驶舱</div>
      <div class="header-time">
        {{ nowTime }}
        <i class="iconfont icon-quanping" @click="handleScreenFull"></i>
      </div>
    </div>
    <div class="chart-container">
      <div class="chart-aside">
        <div class="chart-item">
          <monitor-count :data="cityCount" />
        </div>
        <div class="chart-item">
          <MonitorArea :data="cityArea" />
        </div>
        <div class="chart-item">
          <SoilQuality :data="soilQuality" />
        </div>
      </div>
      <div id="chart-map" class="chart-map" v-loading="isLoading" element-loading-background="transparent"></div>
      <div class="chart-aside">
        <div class="chart-item">
          <MonthData />
        </div>
        <div class="chart-item">
          <MonitorOpen :data="monitorOpen" />
        </div>
        <div class="chart-item">
          <WaterChange />
        </div>
      </div>
    </div>
  </div>
  <div ref="monitorOverlay" class="monitor-overlay"></div>
</template>
<style scoped>
/* 
    vw = (px / 分辨率)* 100
*/
#map-screen {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: #0a0a0a;
  color: #ededed;
  background-image: linear-gradient(
      rgba(255, 255, 255, 0.1) 0.05vw,
      transparent 0.05vw
    ),
    linear-gradient(90deg, rgba(255, 255, 255, 0.1) 0.05vw, transparent 0.05vw);
  background-size: 3.125vw 3.125vw;
  background-position: center center;
  overflow: hidden;
  font-family: "TaoBaoMaiCaiTi";
  font-size: 1.04vw;
}
.header-container {
  height: 4.7vw;
  background-image: url("/src/assets/header_bg.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  display: flex;
  padding: 0.4vw;
}
.header-city {
  width: 10.4vw;
}
.header-title {
  flex: 1;
  text-align: center;
  font-size: 1.56vw;
}
.header-time {
  width: 10.4vw;
  text-align: right;
  font-family: "DS";
}
.icon-chengshi {
  font-size: 1.04vw;
  cursor: pointer;
}
.chart-container {
  display: flex;
  height: calc(100vh - 4.7vw);
}
.chart-aside {
  width: 20vw;
  display: flex;
  flex-direction: column;
  gap: 1.04vw;
}
.chart-map {
  flex: 1;
}
.chart-item {
  flex: 1;
  background: url("/src/assets/chart_bg.png");
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
.map-back {
  cursor: pointer;
  &:hover {
    text-decoration: underline;
  }
}
.monitor-overlay {
  padding: 1vw;
  border-radius: 1vw;
  background-color: #0000FF80;
}
</style>
