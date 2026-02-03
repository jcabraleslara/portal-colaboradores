

interface CopItemProps {
    label: string
    value: number
    color: string
}

export function CopItem({ label, value, color }: CopItemProps) {
    const colorClasses: Record<string, string> = {
        amber: 'bg-amber-100 text-amber-700',
        red: 'bg-red-100 text-red-700',
        blue: 'bg-blue-100 text-blue-700',
        slate: 'bg-slate-200 text-slate-700',
        green: 'bg-green-100 text-green-700',
    }

    return (
        <div className={`p-2 rounded-lg ${value > 0 ? colorClasses[color] : 'bg-slate-50 text-slate-400'}`}>
            <div className="text-lg font-bold">{value}</div>
            <div className="text-[10px]">{label}</div>
        </div>
    )
}
