import EnviosTabs from './EnviosTabs'
import SendHistory from './SendHistory'
import UpcomingSends from './UpcomingSends'

export default async function EnviosPage({ searchParams }) {
  const query = await searchParams
  const activeView = query?.view === 'scheduled' ? 'scheduled' : 'history'

  return (
    <EnviosTabs activeView={activeView}>
      {activeView === 'scheduled' ? <UpcomingSends /> : <SendHistory />}
    </EnviosTabs>
  )
}
