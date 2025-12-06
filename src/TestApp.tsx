export default function TestApp() {
    return (
        <div style={{
            width: '100vw',
            height: '100vh',
            backgroundColor: '#FF0000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            color: 'white',
            fontSize: '32px',
            fontFamily: 'Arial'
        }}>
            <h1 style={{ fontSize: '64px', marginBottom: '20px' }}>
                🎯 TELA DE TESTE
            </h1>
            <p>Se você está vendo esta tela VERMELHA, o app está funcionando!</p>
            <p style={{ fontSize: '24px', marginTop: '20px' }}>
                Ambiente OK ✅
            </p>
        </div>
    );
}
