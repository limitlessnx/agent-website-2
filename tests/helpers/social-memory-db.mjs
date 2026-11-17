export function memoryDb(seed) {
  const tables = structuredClone(seed), changes = [];
  let count = 0;
  const db = { tables, changes, beforeUpdate: null, from(table) {
    const filters = []; let kind = 'select', values, ordering, maximum;
    const copy = (value) => structuredClone(value);
    const get = (row, key) => key.includes('->>') ? row[key.split('->>')[0]]?.[key.split('->>')[1]] : row[key];
    function execute() {
      tables[table] ||= [];
      if (kind === 'insert') {
        const input = Array.isArray(values) ? values : [values];
        const inserted = input.map((row) => ({ id: `new-${++count}`, ...copy(row) }));
        tables[table].push(...inserted);changes.push({table,kind,values:copy(inserted)});
        return {data:copy(inserted),error:null};
      }
      if (kind === 'upsert') {
        const input = Array.isArray(values.rows) ? values.rows : [values.rows];
        const result = input.map((row) => {
          const keys = values.options?.onConflict?.split(',') || ['id'];
          const existing = tables[table].find((candidate) => keys.every((key) => candidate[key] === row[key]));
          if (existing) { if (!values.options?.ignoreDuplicates) Object.assign(existing,copy(row)); return existing; }
          const added = {id:`new-${++count}`,attempt_count:0,max_attempts:3,...copy(row)}; tables[table].push(added); return added;
        }); changes.push({table,kind,values:copy(result)});return {data:copy(result),error:null};
      }
      if (kind === 'update') db.beforeUpdate?.(table, values, tables);
      let found = tables[table].filter((row) => filters.every((filter) => filter(row)));
      if (ordering) found.sort((a,b) => String(get(a,ordering)).localeCompare(String(get(b,ordering))));
      if (maximum) found = found.slice(0,maximum);
      if (kind === 'update') { found.forEach((row) => Object.assign(row,copy(values)));changes.push({table,kind,values:copy(values),ids:found.map((row)=>row.id)}); }
      return {data:copy(found),error:null};
    }
    const q = {select(){return q;},eq(key,value){filters.push((row)=>get(row,key)===value);return q;},
      in(key,values){filters.push((row)=>values.includes(get(row,key)));return q;},
      gte(key,value){filters.push((row)=>get(row,key)!=null&&get(row,key)>=value);return q;},
      lt(key,value){filters.push((row)=>get(row,key)!=null&&get(row,key)<value);return q;},
      order(key){ordering=key;return q;},limit(value){maximum=value;return q;},
      update(input){kind='update';values=input;return q;},insert(input){kind='insert';values=input;return q;},
      upsert(rows,options){kind='upsert';values={rows,options};return q;},
      async single(){const result=execute();return {...result,data:result.data[0]||null};},
      async maybeSingle(){const result=execute();return {...result,data:result.data[0]||null};},
      then(resolve,reject){return Promise.resolve().then(execute).then(resolve,reject);},
    };return q;
  }};return db;
}
