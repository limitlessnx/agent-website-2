import type { AnalyticsDailyPoint } from "@/lib/tenant-analytics-drilldown";

type Series={ key:Exclude<keyof AnalyticsDailyPoint,"date">; label:string };
function numeric(value:unknown){
  return typeof value==="number"&&Number.isFinite(value)?value:0;
}

export default function AnalyticsTrendChart({
  data,series,title,description,
}:{
  data:AnalyticsDailyPoint[];series:Series[];title:string;description:string;
}){
  const width=760;
  const height=220;
  const padX=28;
  const padTop=18;
  const padBottom=34;
  const plotHeight=height-padTop-padBottom;
  const plotWidth=width-padX*2;
  const max=Math.max(1,...data.flatMap((point)=>series.map((item)=>numeric(point[item.key]))));
  const x=(index:number)=>data.length<=1?padX:padX+(index/(data.length-1))*plotWidth;
  const y=(value:number)=>padTop+plotHeight-(value/max)*plotHeight;

  return <section className="portal-card">
    <div className="portal-card-head"><div><h2>{title}</h2><p>{description}</p></div></div>
    <div style={{overflowX:"auto"}}>
      <svg viewBox={"0 0 "+width+" "+height} role="img" aria-label={title} style={{width:"100%",minWidth:620,height:"auto"}}>
        {[0,.25,.5,.75,1].map((ratio)=><line
          key={ratio}
          x1={padX} x2={width-padX}
          y1={padTop+plotHeight*ratio} y2={padTop+plotHeight*ratio}
          stroke="currentColor" opacity=".08"
        />)}
        {series.map((item,seriesIndex)=>{
          const points=data.map((point,index)=>x(index)+","+y(numeric(point[item.key]))).join(" ");
          return <polyline
            key={item.key}
            fill="none"
            stroke="currentColor"
            opacity={1-seriesIndex*.22}
            strokeWidth={seriesIndex===0?3:2}
            points={points}
          />;
        })}
        {data.length?<text x={padX} y={height-8} fill="currentColor" opacity=".55" fontSize="11">
          {String(data[0].date||"")}
        </text>:null}
        {data.length>1?<text x={width-padX} y={height-8} fill="currentColor" opacity=".55" fontSize="11" textAnchor="end">
          {String(data[data.length-1].date||"")}
        </text>:null}
        <text x={padX} y={12} fill="currentColor" opacity=".55" fontSize="11">{max}</text>
      </svg>
    </div>
    <div style={{display:"flex",flexWrap:"wrap",gap:14,marginTop:8}}>
      {series.map((item,index)=><small key={item.key} style={{opacity:1-index*.22}}>{item.label}</small>)}
    </div>
  </section>;
}
