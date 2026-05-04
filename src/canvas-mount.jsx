// Mount all screens into design canvas
const Mount = () => (
  <DesignCanvas
    title="Bot Conversor · Telas do produto"
    subtitle="Fluxo principal — onboarding até painel de comissões"
  >
    <DCSection id="produto" title="App web · operação">
      <DCArtboard id="onb" label="01 · Conectar WhatsApp (onboarding)" width={1280} height={820}>
        <ScreenOnboarding/>
      </DCArtboard>
      <DCArtboard id="dash" label="02 · Painel" width={1280} height={920}>
        <ScreenDashboard/>
      </DCArtboard>
      <DCArtboard id="grp" label="03 · Grupos (origem + destino)" width={1280} height={920}>
        <ScreenGroups/>
      </DCArtboard>
      <DCArtboard id="rul" label="04 · Regras de conversão" width={1280} height={920}>
        <ScreenRules/>
      </DCArtboard>
      <DCArtboard id="tpl" label="05 · Mensagens promocionais" width={1280} height={820}>
        <ScreenTemplates/>
      </DCArtboard>
      <DCArtboard id="logs" label="06 · Logs de envio" width={1280} height={1000}>
        <ScreenLogs/>
      </DCArtboard>
    </DCSection>

    <DCSection id="ajustes" title="Ajustes · cada tópico é uma tela">
      <DCArtboard id="aff" label="07 · IDs de afiliada" width={1280} height={760}>
        <ScreenAfiliada/>
      </DCArtboard>
      <DCArtboard id="conta" label="08 · Conta" width={1280} height={760}>
        <ScreenConta/>
      </DCArtboard>
      <DCArtboard id="wpp" label="09 · Conexão WhatsApp" width={1280} height={760}>
        <ScreenWhatsapp/>
      </DCArtboard>
      <DCArtboard id="notif" label="10 · Notificações" width={1280} height={760}>
        <ScreenNotif/>
      </DCArtboard>
      <DCArtboard id="plano" label="11 · Plano e cobrança" width={1280} height={840}>
        <ScreenPlano/>
      </DCArtboard>
      <DCArtboard id="seg" label="12 · Segurança" width={1280} height={840}>
        <ScreenSeguranca/>
      </DCArtboard>
    </DCSection>
  </DesignCanvas>
);

ReactDOM.createRoot(document.getElementById('canvas-root')).render(<Mount/>);
