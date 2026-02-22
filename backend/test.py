import asyncio
import websockets

async def test():
    uri = "ws://localhost:8000/ws/terminal/test123"
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ Connected!")
            await websocket.send("test")
            response = await websocket.recv()
            print(f"📨 Received: {response}")
    except Exception as e:
        print(f"❌ Error: {e}")

asyncio.run(test())