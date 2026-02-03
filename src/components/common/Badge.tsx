import React from 'react'

interface BadgeProps {
    children: React.ReactNode
    color: string
}

export function Badge({ children, color }: BadgeProps) {
    const colorClasses: Record<string, string> = {
        green: 'bg-green-100 text-green-700',
        blue: 'bg-blue-100 text-blue-700',
        purple: 'bg-purple-100 text-purple-700',
        amber: 'bg-amber-100 text-amber-700',
        red: 'bg-red-100 text-red-700',
        slate: 'bg-slate-100 text-slate-700',
        cyan: 'bg-cyan-100 text-cyan-700',
    }

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClasses[color] || colorClasses.slate}`}>
            {children}
        </span>
    )
}
