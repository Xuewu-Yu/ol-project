export interface Monitor {
    id: number
    name: string
    lng: number
    lat: number
    city: string
    status: 'on' | 'off'
    quality: number
    monitorArea: number
    allArea: number
}
export interface Month {
    id: number
    name: string
    count: number
}