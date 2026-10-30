// Runs every *.test.mjs in one process. Node ≥ 23.6 names the flag --test-isolation; Node 22 uses the experimental name.
import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const [major,minor]=process.versions.node.split('.').map(Number);
const flag=major>23||(major===23&&minor>=6)?'--test-isolation=none':'--experimental-test-isolation=none';
const files=readdirSync('.').filter(name=>name.endsWith('.test.mjs')).sort();
const result=spawnSync(process.execPath,['--test',flag,...files],{stdio:'inherit'});
process.exit(result.status??1);
