import type { Monitor } from "./types"
export const monitorGeoJSON = (data: Monitor[]) => {
    const result = {
        type: 'FeatureCollection',
        features: []
    } as GeoJSON.FeatureCollection

    data.forEach(j => {
        const feature: GeoJSON.Feature = {
            type: 'Feature',
            properties: { ...j },
            geometry: {
                type: 'Point',
                coordinates: [j.lng, j.lat] as [number, number]
            }
        }
        result.features.push(feature)
    });
    return result
}