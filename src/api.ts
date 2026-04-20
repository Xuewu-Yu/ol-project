import type { Monitor } from "./types"
export const getMonitors = async () => {
    const res = await fetch('http://localhost:3000/monitors')
    if (!res.ok) {
        throw new Error('Network response was not ok')
    }
    return res.json()
}

export const updateMonitor = async (monitor: Monitor) => {
    const res = await fetch(`http://localhost:3000/monitors/${monitor.id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(monitor)
    })
    if (!res.ok) {
        throw new Error('Network response was not ok')
    }
    return res.json()
}
export const createMonitor = async (monitor: Monitor) => {
    const res = await fetch(`http://localhost:3000/monitors`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(monitor)
    })
    if (!res.ok) {
        throw new Error('Network response was not ok')
    }
    return res.json()
}
export const deleteMonitor = async (id: number) => {
    const res = await fetch(`http://localhost:3000/monitors/${id}`, {
        method: 'DELETE',
    })
    if (!res.ok) {
        throw new Error('Network response was not ok')
    }
    return res.json()
}