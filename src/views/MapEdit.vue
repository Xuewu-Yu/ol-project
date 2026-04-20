<script setup lang="ts">
import { onMounted, ref, reactive, computed } from "vue";
import { Map, View, MapBrowserEvent, Feature } from "ol";
import { Tile as TileLayer, Vector as VectorLayer } from "ol/layer";
import { XYZ, Vector } from "ol/source";
import { Style, Stroke, Fill, Text, Circle, Icon } from "ol/style";
import { fromLonLat, transformExtent, toLonLat } from "ol/proj";
import { GeoJSON } from "ol/format";
import {
  defaults as defaultsControls,
  ScaleLine,
  ZoomSlider,
  FullScreen,
  OverviewMap,
} from "ol/control";
import { ElMessage } from 'element-plus'
import { Translate, Draw } from "ol/interaction";
import {
  TDT_TOKEN,
  ZJS_CENTER,
  ZJS_EXTENT,
  ZJS_GeoJSON_URL,
  ZJS_CITYS,
  GEOMETRY_TYPES,
  QUALITY_LEVELS
} from "@/config";
import { getMonitors, updateMonitor, deleteMonitor, createMonitor } from '@/api.ts'
import { monitorGeoJSON } from '@/utils'

import type { Monitor } from '@/types.ts'
import type { Geometry, Point } from 'ol/geom'
import type { FeatureLike } from "ol/Feature";
import type { FormInstance, FormRules } from "element-plus";

import jiance_on from '@/assets/jiance_on.png'
import jiance_off from '@/assets/jiance_off.png'

let map: Map;
let isDrawing = false

const tdt_vecUrl =
  "https://t0.tianditu.gov.cn/DataServer?T=vec_w&x={x}&y={y}&l={z}&tk=" +
  TDT_TOKEN;
const tdt_cvaUrl =
  "https://t0.tianditu.gov.cn/DataServer?T=cva_w&x={x}&y={y}&l={z}&tk=" +
  TDT_TOKEN;
const center = fromLonLat(ZJS_CENTER);
const extent = transformExtent(ZJS_EXTENT, "EPSG:4326", "EPSG:3857");

const nowCity = ref<string>("城市");
const nowGeometry = ref('绘制')
const drawerVisible = ref<boolean>(false)
const drawerFormRef = ref<FormInstance>()
const drawerForm = reactive<Monitor>({
  id: 0,
  name: '',
  lng: 0,
  lat: 0,
  city: '',
  status: 'on',
  quality: 3,
  monitorArea: 0,
  allArea: 0
})
const drawerRules = reactive<FormRules>({
  name: [
    {required:true, message: '请输入监测点',trigger: 'blur'},
    { min: 2, max: 20, message: '长度在2到20个字符之间',trigger: 'blur' }
  ],
  city: [
    {required: true, message: '超出范围',trigger: 'change'}
  ],
  monitorArea: [
    {required: true, message: '请输入监测面积', trigger: 'blur'},
    {
      validator: (rule, value, callback) => {
        if (value === 0) {
          callback(new Error('检测面积不能为0'))
        } else if (value > drawerForm.allArea) {
          callback(new Error('监测面积不能大于总面积'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
  allArea: [
    {required: true, message: '请输入总面积', trigger: 'blur'},
    {
      validator: (rule, value, callback) => {
        if (value === 0) {
          callback(new Error('监测面积不能为0'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ],
})

const qualityText = computed(() => {
  return QUALITY_LEVELS.find(item => item.value === drawerForm.quality).name
})

const getCoordinates = (feature: Feature) => {
    const geometry = feature.getGeometry()
    if (geometry && geometry.getType() === 'Point') {
      return (geometry as Point).getCoordinates()
    }
    return [0, 0]
  }

const initCityVectorStyle = new Style({
  stroke: new Stroke({
    color: "#FF0000",
    width: 2,
    lineDash: [10, 10],
  }),
  fill: new Fill({
    color: "rgba(255, 255, 255, 0)",
  }),
});

const activeCityVectorStyle = new Style({
  stroke: new Stroke({
    color: "#0000FF",
    width: 2,
    lineDash: [10, 10],
  }),
  fill: new Fill({
    color: "rgba(255, 255, 0, 0.3)",
  }),
});

const overviewStyle = (feature: FeatureLike) => {
  return new Style({
    stroke: new Stroke({
      color: "#FF0000",
      width: 1,
    }),
    text: new Text({
      font: "12px sans-serif",
      fill: new Fill({
        color: "#005500",
      }),
      text: feature.get("name"),
    }),
  });
};

const baseVecLayer = new TileLayer({
  source: new XYZ({
    url: tdt_vecUrl,
  }),
});
const baseCvaLayer = new TileLayer({
  source: new XYZ({
    url: tdt_cvaUrl,
  }),
});
const cityLayer = new VectorLayer({
  source: new Vector({
    url: ZJS_GeoJSON_URL,
    format: new GeoJSON({
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    }),
  }),
  style: initCityVectorStyle,
});

const overviewLayer = new VectorLayer({
  source: new Vector({
    url: ZJS_GeoJSON_URL,
    format: new GeoJSON({
      dataProjection: "EPSG:4326",
      featureProjection: "EPSG:3857",
    }),
  }),
  style: overviewStyle,
});

const monitorLayer = new VectorLayer({
  source: new Vector<Feature<Geometry>>({
    features: []
  }),
  style: (feature: FeatureLike) => {
    const status = feature.get('status') ?? 'on'
    return new Style({
      image: new Icon({
        src: status === 'on' ? jiance_on : jiance_off,
        width: 50,
        height: 50
      })
    })
  }
})
const geometryLayer = new VectorLayer({
  source: new Vector<Feature<Geometry>>({
    features: []
  }),
  style: (feature: FeatureLike) => {
    return new Style({
      image: new Circle({
        radius: 10,
        fill: new Fill({
          color: '#FFF0080'
        }),
        stroke: new Stroke({
          color: '#FF0000',
          width: 2
        })
      }),
      fill: new Fill({
        color: '#FFF0080'
      }),
      stroke: new Stroke({
        color: '#FF0000',
        width: 2
      }),
      text: new Text({
        font: '14px sans-serif',
        fill: new Fill({
          color: '#0000FF'
        }),
        text: feature.get('area')
      })
    })
  }
})


// 设置当前选中图层样式
const activeCityFeature = (
  features: Feature[],
  feature: Feature,
  name: string
) => {
  nowCity.value = name;
  features.forEach((f) => {
    f.setStyle(initCityVectorStyle);
  });
  feature.setStyle(activeCityVectorStyle);
  const geometry = feature.getGeometry();
  if (geometry) {
    map.getView().fit(geometry.getExtent(), {
      duration: 500,
    });
  }
};
// 点击切换图层
const handleClickFeature = (e: MapBrowserEvent) => {
  if (isDrawing) return
  const monitorFeature = map.forEachFeatureAtPixel(
    e.pixel,
    (feat) => {
      return feat instanceof Feature ? feat : null;
    },
    {
      layerFilter: (layer) => layer === monitorLayer,
    }
  );
  if (monitorFeature) {
    const coord = getCoordinates(monitorFeature)
    map.getView().animate({
      center: coord,
      zoom: 12,
      duration: 500
    })
    return;
  }


  const cityFeatures = cityLayer.getSource()?.getFeatures() || [];
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
    const props = cityFeature.getProperties();
    activeCityFeature(cityFeatures, cityFeature, props.name);
  }
};

const handleToolCity = (command: string) => {
  const cityFeatures = cityLayer.getSource()?.getFeatures() || [];
  const cityFeature = cityFeatures.find((item) => item.get("name") === command);
  cityFeature && activeCityFeature(cityFeatures, cityFeature, command);
};
const handleToolGeometry = (command: string) => {
  nowGeometry.value = command
  const type = GEOMETRY_TYPES.find(item => item.name === command)?.value
  if (type === 'Polygon' || type === 'Circle') {
    isDrawing = true
    const drawGeometryInteraction = new Draw({
      source: geometryLayer.getSource() as Vector<Feature<Geometry>>,
      type,
    })
  }
}

const getCityName = (feature: Feature) => {
  // 通过经纬度获取要素
  const coord = getCoordinates(feature)
  const cityFeatures = cityLayer.getSource()?.getFeatures() || []
  for (const cityFeature of cityFeatures) {
    const cityGeom = cityFeature.getGeometry()
    if (cityGeom && cityGeom.intersectsCoordinate(coord)) {
      // console.log('=====>', cityFeature)
      return cityFeature.get('name')
    }
  }
  return ''
}

const renderMonitors = () => {
  monitorLayer.getSource()?.clear()
  drawerFormRef.value?.resetFields()
  drawerVisible.value = false


  // 添加交互
  const translate = new Translate({
    layers: [monitorLayer]
  })
  map.addInteraction(translate)
  translate.on('translateend', e => {
    e.features.forEach(f => {
      const {
        name = '',
        id = 0,
        status = 'on',
        quality = 3,
        monitorArea = 0,
        allArea = 0
     } = f.getProperties()
     if (!drawerVisible.value || drawerForm.id !== id) {
      drawerForm.id = id
      drawerForm.name = name
      drawerForm.status = status
      drawerForm.quality = quality
      drawerForm.monitorArea = monitorArea
      drawerForm.allArea = allArea
      drawerVisible.value = true
     }
     const coord = getCoordinates(f)
     const lonlat = toLonLat(coord)
     drawerForm.lng = Number(lonlat[0].toFixed(4))
     drawerForm.lat = Number(lonlat[1].toFixed(4))
     drawerForm.city = nowCity.value = getCityName(f)
    //  console.log(f.get('city'))
    })
  })


  getMonitors().then((res) => {
    // console.log(res)
    const features = new GeoJSON().readFeatures(monitorGeoJSON(res), {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857'
    })
    // 添加到地图
    monitorLayer.getSource()?.addFeatures(features)
  })
}

// 添加监测点
const handleCreateMonitor = () => {
  drawerVisible.value = false
  const drawMonitorInteraction = new Draw({
    source: monitorLayer.getSource() as Vector<Feature<Geometry>>,
    type: 'Point'
  })
  map.addInteraction(drawMonitorInteraction)
  drawMonitorInteraction.on('drawend', (e) => {
    map.removeInteraction(drawMonitorInteraction)
    nowCity.value = getCityName(e.feature)
  })
}

const drawerFormEditSubmit = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate((valid, fields) => {
    if (valid) {
      updateMonitor(drawerForm).then(() => {
        ElMessage({
          message: '更新成功',
          type: 'success',
          appendTo: '#map-edit'
        })
        renderMonitors()
      })
    } else {
      console.log('error submit !', fields)
    }
  })
}
const drawerFormCreateSubmit = async (formEl: FormInstance | undefined) => {
  if (!formEl) return
  await formEl.validate((valid, fields) => {
    if (valid) {
      createMonitor(drawerForm).then(() => {
        ElMessage({
          message: '添加成功',
          type: 'success',
          appendTo: '#map-edit'
        })
        renderMonitors()
      })
    } else {
      console.log('error submit !', fields)
    }
  })
}

const drawerRemoveMonitor = (id: number) => {
  deleteMonitor(id).then(() => {
    ElMessage({
      message: '删除成功',
      type: 'success',
      appendTo: '#map-edit'
    })
    renderMonitors()
  })
}


onMounted(() => {
  map = new Map({
    target: "map-edit",
    layers: [baseVecLayer, baseCvaLayer, cityLayer, monitorLayer, geometryLayer],
    view: new View({
      center,
      extent,
      zoom: 2,
    }),
    controls: defaultsControls().extend([
      new ScaleLine(),
      new ZoomSlider(),
      new FullScreen(),
      new OverviewMap({
        layers: [overviewLayer],
        collapsed: false,
        view: new View({
          extent,
        }),
      }),
    ]),
  });
  map.on("singleclick", handleClickFeature);
  renderMonitors()
});
</script>
<template>
  <div id="map-edit">
    <div id="map-tools">
      <el-button-group size="large">
        <el-button type="success" icon="Place">
          <el-dropdown @command="handleToolCity" :teleported="false">
            <span class="dropdown-link">
              {{ nowCity }}
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu class="menu-citys">
                <el-dropdown-item
                  v-for="x in ZJS_CITYS"
                  :key="x.value"
                  :command="x.name"
                  >{{ x.name }}</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-button>
        <el-button type="success" icon="AddLocation" @click="handleCreateMonitor">监测点</el-button>
        <el-button type="success" icon="EditPen">
          <el-dropdown @command="handleToolGeometry" :teleported="false">
            <span class="dropdown-link">
              {{ nowGeometry }}
              <el-icon class="el-icon--right"><arrow-down /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu class="">
                <el-dropdown-item
                  v-for="x in GEOMETRY_TYPES"
                  :key="x.value"
                  :command="x.name"
                  >{{ x.name }}</el-dropdown-item
                >
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </el-button>
        <el-button type="success" icon="View">大屏</el-button>
      </el-button-group>
    </div>
    <el-drawer v-model="drawerVisible" :modal="false" title="数据面板" modal-class="map-edit-drawer" size="100%">
      <template #default>
        <el-form ref="drawerFormRef" :model="drawerForm" :rules="drawerRules" label-position="top" style="width
        100%">
          <el-form-item label="名称" prop="name">
            <el-input v-model="drawerForm.name" placeholder="请输入监测点"></el-input>
          </el-form-item>
          <el-form-item label="经度" prop="lng">
            <el-input v-model.number="drawerForm.lng" disabled >
              <template #append>°E</template>
            </el-input>
          </el-form-item>
          <el-form-item label="纬度" prop="lat">
            <el-input v-model.number="drawerForm.lat" disabled>
              <template #append>°N</template>
            </el-input>
          </el-form-item>
          <el-form-item label="总面积" prop="allArea">
            <el-input v-model="drawerForm.allArea" type="number" placeholder="请输入总面积" @blur="drawerForm.allArea = Number(drawerForm.allArea)">
              <template #append>km²</template>
            </el-input>
          </el-form-item>
          <el-form-item label="监测面积" prop="monitorArea">
            <el-input v-model="drawerForm.monitorArea" type="number" placeholder="请输入监测面积" @blur="drawerForm.monitorArea = Number(drawerForm.monitorArea)">
              <template #append>km²</template>
            </el-input>
          </el-form-item>
          <el-form-item label="城市" prop="city">
            {{ drawerForm.city }}
          </el-form-item>
          <el-form-item label="设备状态" prop="status">
            <el-switch v-model="drawerForm.status" active-value="on" inactive-value="off" active-text="开启" inactive-text="关闭"></el-switch>
          </el-form-item>
          <el-form-item label="土壤质量" prop="quality">
            <el-col :span="3">{{ qualityText }}</el-col>
            <el-col :span="20" :offset="1">
              <el-slider v-model="drawerForm.quality" :show-tooltip="false" :min="0" :max="4" show-stops></el-slider>
            </el-col>

          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <div style="flex: auto">
          <el-button v-if="drawerForm.id === 0" type="primary" @click="drawerFormCreateSubmit(drawerFormRef
          )">添加监测点</el-button>
          <template v-else>
            <el-button type="primary" @click="drawerFormEditSubmit(drawerFormRef)">更新数据</el-button>
            <el-popconfirm title="是否删除监测点？" placement="top-end" :teleported="false" confirm-button-text="是" cancel-button-text="否" @confirm="drawerRemoveMonitor(drawerForm.id)">
              <template #reference>
                <el-button type="danger">删除监测点</el-button>
              </template>
            </el-popconfirm>
          </template>
        </div>
      </template>
    </el-drawer>
  </div>
</template>
<style scoped>
#map-edit {
  position: absolute;
  inset: 0;
  z-index: 0;
}
#map-tools {
  position: absolute;
  top: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
}
.dropdown-link {
  color: #fff;
  outline: none;
}
.menu-citys {
  display: grid;
  grid-template-columns: repeat(3, minmax(100px, 1fr));
}
::v-deep(.ol-overviewmap) {
  left: auto;
  right: 0.5em;
  .ol-overviewmap-map {
    width: 300px;
    height: 300px;
  }
}
</style>
