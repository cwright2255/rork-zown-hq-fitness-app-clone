// app/running/program/[id].jsx
//
// A third, separate program-detail implementation, alongside
// app/running/[id].jsx and app/running/session/[id].jsx. This one read
// `runningPrograms`/`startProgram`/`activeProgram` from store/workoutStore.js
// -- fields that were removed earlier this session as fake mock data (see
// the audit's "only real data" pass), meaning this screen's `program`
// lookup always resolved to null and it always rendered "Program not
// found." Confirmed via search that nothing in the app actually links to
// this route. app/running/[id].jsx is the real, working program-detail
// screen -- redirects there instead of maintaining a third dead-end copy.

import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RunningProgramDetailRedirect() {
  const params = useLocalSearchParams();
  const id = typeof params.id === 'string' ? params.id : '';
  return <Redirect href={`/running/${id}`} />;
}
